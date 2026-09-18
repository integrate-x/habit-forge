import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

type Habit={id:number;name:string;time:string;site:string;days:number[];done:boolean};
const key='habit-forge';
const defaults:Habit[]=[
 {id:1,name:'LeetCode',time:'21:00',site:'https://leetcode.com',days:[0,1,2,3,4,5],done:false},
 {id:2,name:'GitHub',time:'18:00',site:'https://github.com',days:[0,1,2,3,4],done:false}
];
function App(){
 const [habits,setHabits]=useState<Habit[]>(()=>JSON.parse(localStorage.getItem(key)||'null')||defaults);
 const [name,setName]=useState(''); const [time,setTime]=useState('21:00'); const [site,setSite]=useState('https://leetcode.com');
 useEffect(()=>localStorage.setItem(key,JSON.stringify(habits)),[habits]);
 const add=()=>{if(!name)return;setHabits([...habits,{id:Date.now(),name,time,site,days:[0,1,2,3,4,5,6],done:false}]);setName('')};
 const toggle=(id:number)=>setHabits(h=>h.map(x=>x.id===id?{...x,done:!x.done}:x));
 const remove=(id:number)=>setHabits(h=>h.filter(x=>x.id!==id));
 const repeat=()=>setHabits(h=>h.map(x=>({...x,days:[0,1,2,3,4,5,6]})));
 return <main><h1>Habit Forge</h1><p className="sub">Local-first consistency dashboard</p>
 <section className="card"><h2>Add habit</h2><div className="form"><input placeholder="Habit name" value={name} onChange={e=>setName(e.target.value)}/><input type="time" value={time} onChange={e=>setTime(e.target.value)}/><input value={site} onChange={e=>setSite(e.target.value)}/><button onClick={add}>Add</button></div></section>
 <section className="card"><div className="row"><h2>Today's routine</h2><button onClick={repeat}>↻ Repeat routine</button></div>{habits.map(h=><div className="habit" key={h.id}><div><strong>{h.name}</strong><span>{h.time} · {h.site}</span></div><button onClick={()=>toggle(h.id)} className={h.done?'done':''}>{h.done?'✓ Completed':'Complete'}</button><button className="delete" onClick={()=>remove(h.id)}>Delete</button></div>)}</section>
 <section className="card"><h2>7-day completion snapshot</h2><div className="bars">{['M','T','W','T','F','S','S'].map((d,i)=><div key={i}><i style={{height:`${20+(i<habits.length?60:25)}px`}}></i><small>{d}</small></div>)}</div><p className="muted">This MVP keeps only local configuration and current completion state. No server or account is used.</p></section>
 </main>}
createRoot(document.getElementById('root')!).render(<App/>);
