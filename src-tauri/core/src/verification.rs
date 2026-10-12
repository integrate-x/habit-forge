use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyRequest {
    pub provider: String, pub username: String, pub minimum: u32,
    pub time_zone: String, pub local_date: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    provider: String, username: String, local_date: String, pub count: usize, unit: String,
}
impl VerifyRequest {
    fn validate(&self, now: DateTime<Utc>) -> Result<Tz, String> {
        if !["leetcode", "kaggle"].contains(&self.provider.as_str()) || self.username.is_empty() ||
            self.username.len() > 40 || !self.username.as_bytes()[0].is_ascii_alphanumeric() ||
            !self.username.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') ||
            !(1..=100).contains(&self.minimum) { return Err("Invalid provider, username or requirement (1-100).".into()); }
        let zone: Tz = self.time_zone.parse().map_err(|_| "Invalid timezone.")?;
        if now.with_timezone(&zone).format("%Y-%m-%d").to_string() != self.local_date { return Err("Date changed. Retry verification.".into()); }
        Ok(zone)
    }
}
pub fn count_leetcode(data: &Value, request: &VerifyRequest, now: DateTime<Utc>) -> Result<usize, String> {
    let zone = request.validate(now)?;
    if data.get("errors").is_some_and(|errors| errors.as_array().is_none_or(|errors| !errors.is_empty())) {
        return Err("LeetCode query failed or its response format changed.".into());
    }
    let username = data["data"]["matchedUser"]["username"].as_str().ok_or("LeetCode username was not found or is private.")?;
    if !username.eq_ignore_ascii_case(&request.username) { return Err("LeetCode returned an unexpected account.".into()); }
    let entries = data["data"]["recentAcSubmissionList"].as_array().ok_or("LeetCode response format changed.")?;
    let mut solved = HashSet::new();
    for item in entries {
        item["id"].as_str().ok_or("Invalid LeetCode submission.")?;
        let slug = item["titleSlug"].as_str().filter(|slug| !slug.is_empty()).ok_or("Invalid LeetCode problem.")?;
        let timestamp = item["timestamp"].as_str().filter(|time| !time.is_empty() && time.bytes().all(|b| b.is_ascii_digit())).ok_or("Invalid LeetCode timestamp.")?;
        let seconds = timestamp.parse::<i64>().map_err(|_| "Invalid LeetCode timestamp.")?;
        let date = DateTime::from_timestamp(seconds, 0).ok_or("Invalid LeetCode timestamp.")?;
        if date <= now && date.with_timezone(&zone).format("%Y-%m-%d").to_string() == request.local_date { solved.insert(slug.to_owned()); }
    }
    Ok(solved.len())
}
pub fn count_kaggle(data: &[Value], request: &VerifyRequest, now: DateTime<Utc>) -> Result<usize, String> {
    let zone = request.validate(now)?;
    let mut notebooks = HashSet::new();
    for item in data {
        let reference = item["ref"].as_str().ok_or("Invalid Kaggle notebook.")?;
        let (owner, slug) = reference.split_once('/').ok_or("Invalid Kaggle notebook.")?;
        if owner.is_empty() || slug.is_empty() || slug.contains('/') { return Err("Invalid Kaggle notebook.".into()); }
        if !owner.eq_ignore_ascii_case(&request.username) { continue; }
        if item["lastRunTime"].is_null() { continue; }
        let timestamp = item["lastRunTime"].as_str().ok_or("Invalid Kaggle timestamp.")?;
        if timestamp.is_empty() { continue; }
        let date = DateTime::parse_from_rfc3339(timestamp).map_err(|_| "Kaggle returned an unsupported notebook timestamp.")?.with_timezone(&Utc);
        if date <= now && date.with_timezone(&zone).format("%Y-%m-%d").to_string() == request.local_date { notebooks.insert(reference.to_lowercase()); }
    }
    Ok(notebooks.len())
}
async fn json_response(response: reqwest::Response, provider: &str) -> Result<Value, String> {
    let status = response.status();
    if !status.is_success() {
        return Err(match status {
            StatusCode::UNAUTHORIZED => format!("{provider} authentication failed. Check environment credentials."),
            StatusCode::FORBIDDEN => format!("{provider} denied access. Retry later."),
            StatusCode::TOO_MANY_REQUESTS => format!("{provider} rate limit reached. Retry later."),
            _ => format!("{provider} returned HTTP {}.", status.as_u16()),
        });
    }
    response.json().await.map_err(|_| format!("{provider} returned an unexpected response."))
}
pub async fn verify(request: VerifyRequest) -> Result<VerifyResult, String> {
    let now = Utc::now();
    request.validate(now)?;
    let client = Client::builder().timeout(Duration::from_secs(15)).redirect(reqwest::redirect::Policy::none())
        .build().map_err(|_| "Native verification is unavailable.")?;
    let network_error = |_| "Provider request failed or timed out. Retry later.".to_string();
    let (count, unit) = if request.provider == "leetcode" {
        let response = client.post("https://leetcode.com/graphql/").json(&json!({
            "query": "query HabitForgeActivity($username: String!, $limit: Int!) { matchedUser(username: $username) { username } recentAcSubmissionList(username: $username, limit: $limit) { id titleSlug timestamp } }",
            "variables": {"username": request.username, "limit":100}
        })).send().await.map_err(network_error)?;
        (count_leetcode(&json_response(response, "LeetCode").await?, &request, now)?, "distinct accepted problems")
    } else {
        let token = std::env::var("KAGGLE_API_TOKEN").ok().filter(|value| !value.is_empty());
        let legacy = std::env::var("KAGGLE_USERNAME").ok().zip(std::env::var("KAGGLE_KEY").ok())
            .filter(|(user, key)| !user.is_empty() && !key.is_empty());
        if token.is_none() && legacy.is_none() { return Err("Kaggle credentials are not configured in the desktop environment.".into()); }
        let mut records = Vec::new();
        for page in 1..=3 {
            let mut call = client.get("https://www.kaggle.com/api/v1/kernels/list")
                .query(&[("user", request.username.clone()), ("page", page.to_string()), ("pageSize", "100".into()),
                    ("sortBy", "dateRun".into()), ("kernelType", "notebook".into()), ("group", "everyone".into())]);
            if let Some(token) = &token { call = call.bearer_auth(token); }
            else if let Some((user, key)) = &legacy { call = call.basic_auth(user, Some(key)); }
            let data = json_response(call.send().await.map_err(network_error)?, "Kaggle").await?;
            let page_records = data.as_array().ok_or("Kaggle response format changed.")?;
            records.extend(page_records.iter().cloned());
            if page_records.len() < 100 { break; }
        }
        (count_kaggle(&records, &request, now)?, "notebooks last run")
    };
    if count < request.minimum as usize { return Err(format!("{count}/{} {unit} found today.", request.minimum)); }
    Ok(VerifyResult { provider: request.provider, username: request.username, local_date: request.local_date, count, unit: unit.into() })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(provider: &str) -> VerifyRequest {
        VerifyRequest { provider: provider.into(), username: "coder".into(), minimum:1, time_zone:"Asia/Kolkata".into(), local_date:"2026-10-13".into() }
    }
    #[test]
    fn validation_uses_local_timezone_and_rejects_bad_inputs() {
        let now = "2026-10-12T18:45:00Z".parse::<DateTime<Utc>>().unwrap();
        let mut value = request("leetcode");
        assert!(value.validate(now).is_ok());
        value.local_date = "2026-10-12".into();
        assert!(value.validate(now).is_err());
        value = request("kaggle"); value.username = "../bad".into();
        assert!(value.validate(now).is_err());
    }
    #[test]
    fn provider_counts_deduplicate_and_reject_future_activity() {
        let now = "2026-10-12T18:45:00Z".parse::<DateTime<Utc>>().unwrap();
        let seconds = now.timestamp().to_string();
        let data = json!({"data":{"matchedUser":{"username":"coder"},"recentAcSubmissionList":[
            {"id":"1","titleSlug":"two-sum","timestamp":seconds}, {"id":"2","titleSlug":"two-sum","timestamp":seconds},
            {"id":"3","titleSlug":"future","timestamp":(now.timestamp()+60).to_string()}]}});
        assert_eq!(count_leetcode(&data, &request("leetcode"), now).unwrap(), 1);
        let data = vec![json!({"ref":"coder/read","lastRunTime":now.to_rfc3339()}),
            json!({"ref":"coder/read","lastRunTime":now.to_rfc3339()}), json!({"ref":"other/read","lastRunTime":now.to_rfc3339()})];
        assert_eq!(count_kaggle(&data, &request("kaggle"), now).unwrap(), 1);
        assert!(count_kaggle(&[json!({"ref":"coder/read","lastRunTime":"2026-10-13T00:15:00"})], &request("kaggle"), now).is_err());
        assert!(count_leetcode(&json!({"errors":[{"message":"query changed"}]}), &request("leetcode"), now).is_err());
    }
}
