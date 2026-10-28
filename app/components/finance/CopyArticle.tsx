'use client';
import {useState} from 'react';
export default function CopyArticle({article}:{article:string}){const [state,setState]=useState('Копировать');return <button type="button" className="ozf-copy" aria-label={'Копировать артикул '+article} onClick={async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(article);setState('Скопировано')}catch{setState('Не скопировано')}setTimeout(()=>setState('Копировать'),2000)}}>{state}</button>}
