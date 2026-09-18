\# Habit Forge Architecture



\## Product Principle



Habit Forge is a local-first personal accountability system.



It helps the user maintain consistency through:

\- Habit tracking

\- Flexible daily routines

\- Streaks

\- Browser accountability

\- Scheduled required-site opening

\- Optional website blocking



\## Core Rules



1\. No account is required.

2\. No cloud database is required.

3\. No telemetry or behavioral analytics.

4\. The operating system must never be locked.

5\. Essential websites and applications must remain accessible.

6\. Blocking applies only to user-selected websites.

7\. If a required habit is already completed, no automatic action should occur.

8\. Exam Mode can temporarily suspend accountability rules.

9\. Grace Days can prevent legitimate exceptions from breaking streaks.



\## Architecture



React + TypeScript + Vite

&#x20;       |

&#x20;       +---- Local application state

&#x20;       |

&#x20;       +---- Browser Extension

&#x20;       |       |

&#x20;       |       +---- Website blocking

&#x20;       |       +---- Scheduled website opening

&#x20;       |       +---- Browser state

&#x20;       |

&#x20;       +---- Future Tauri Desktop Shell

&#x20;               |

&#x20;               +---- Windows notifications

&#x20;               +---- Background scheduling

&#x20;               +---- Chrome communication



\## Data Strategy



Persistent data should be minimal.



Persist:

\- Habit configuration

\- Routine configuration

\- Blocked website configuration

\- Streak state

\- User settings



Temporary data:

\- Completion events

\- Verification responses

\- Browser activity required for enforcement



Raw temporary activity should be deleted after it has been processed.



\## Development Order



1\. Habit Engine

2\. Daily Routines

3\. Repeat Routine

4\. Completion and Streak Engine

5\. Dashboard and Analytics

6\. Notifications

7\. Exam Mode and Grace Days

8\. Browser Extension

9\. Website Blocking

10\. Scheduled Website Opening

11\. Platform Verification

12\. Tauri Desktop Application

13\. Security and Testing

14\. Packaging

