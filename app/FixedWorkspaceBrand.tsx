'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import Breadcrumbs,{type BreadcrumbItem} from './ui/Breadcrumbs';
import WorkspaceDecoration from './WorkspaceDecoration';
import './fixed-workspace-brand.css';
export default function FixedWorkspaceBrand({items}:{items:BreadcrumbItem[]}){const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return mounted?createPortal(<div className="workspace-fixed-brand"><div className="workspace-fixed-path"><Breadcrumbs items={items}/></div><div className="workspace-fixed-logo"><WorkspaceDecoration/></div></div>,document.body):null;}
