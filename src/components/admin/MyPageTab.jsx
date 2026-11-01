import {useEffect,useState} from "react";
import {useLocation} from "react-router-dom";
import {api} from "@/api/client";
import {useI18n,localizedField} from "@/i18n/I18nContext";
import {validTimezone,validPublicUrl} from "@/lib/setupStatus";
import PagesTab from "./PagesTab";
import IntegrationSettings from "./IntegrationSettings";
import {Copy,ExternalLink,Loader2,RefreshCw} from "lucide-react";
const input="mt-1 min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-sm";
const button="min-h-11 rounded-xl border px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-secondary disabled:opacity-50";
const defaults={
 name:"",brand_label:"",github_repo_url:"",slug:"/",context_key:"general",active:true,language_mode:"auto",accent_style:"terracotta",
 booking_type_ids:[],type_overrides:[],default_booking_type_id:"",
 headline_fr:"Prenons rendez-vous.",headline_en:"Let’s book a time.",
 subtitle_fr:"Choisissez le rendez-vous et l’horaire qui vous conviennent.",subtitle_en:"Choose an appointment and a time that work for you.",
 primary_cta_fr:"Confirmer le rendez-vous",primary_cta_en:"Confirm appointment",
};
export default function MyPageTab(){
 const {locale}=useI18n(),fr=locale==="fr",copy=(a,b)=>fr?a:b;
 const [page,setPage]=useState(null),[form,setForm]=useState(null),[types,setTypes]=useState([]),[settings,setSettings]=useState([]);
 const [basics,setBasics]=useState({app_base_url:"",reference_timezone:"UTC"});
 const [baseline,setBaseline]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [advanced,setAdvanced]=useState(false),[advancedVisited,setAdvancedVisited]=useState(false),[integrationRevision,setIntegrationRevision]=useState(0);
 const location=useLocation();
 useEffect(()=>{if(!loading && location.hash==="#integrations")document.getElementById("integrations")?.scrollIntoView?.({block:"start"});},[loading,location.hash]);
 const dirty=!!form && baseline!==JSON.stringify({form,basics});
 async function load(){
  setLoading(true);setError("");
  try{
   const [response,rows]=await Promise.all([api.functions.invoke("adminPages",{action:"list"}),api.entities.Setting.filter({})]);
   const roots=response.data.pages.filter(p=>p.slug==="/" || p.published_slug==="/");
   if(roots.length>1)throw Error("ambiguous_homepage");
   const root=roots[0] || null;
   const next={...defaults,...(root || {})};
   next.booking_type_ids=next.booking_type_ids || [];
   const values=Object.fromEntries(rows.map(row=>[row.key,row.value]));
   if(!next.brand_label)next.brand_label=values.brand_name || "";
   const config={app_base_url:values.app_base_url || "",reference_timezone:values.reference_timezone || "UTC"};
   setPage(root);setForm(next);setBasics(config);setTypes(response.data.types);setSettings(rows);setBaseline(JSON.stringify({form:next,basics:config}));
  }catch{setError(copy("Impossible de charger Ma page. Réessayez avant de modifier la configuration.","Unable to load My page. Retry before editing configuration."));}
  finally{setLoading(false);}
 }
 useEffect(()=>{load();},[]);
 const set=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 async function save(event){
  event.preventDefault();
  if(busy)return;
  const mode=event.nativeEvent.submitter?.value==="publish" || page?.status==="published"?"publish":"save";
  if(!validPublicUrl(basics.app_base_url) || !validTimezone(basics.reference_timezone)){
   setError(copy("Indiquez une adresse HTTPS sans chemin et un fuseau horaire valide.","Enter an HTTPS address without a path and a valid timezone."));return;
  }
  if(form.github_repo_url && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(form.github_repo_url.trim())){
   setError(copy("Indiquez une URL de dépôt GitHub : https://github.com/organisation/depot.","Enter a GitHub repository URL: https://github.com/organisation/repository."));return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const payload={...form,name:form.brand_label.trim() || form.name,slug:"/",context_key:form.context_key || "general",active:mode==="publish"?true:form.active};
   const response=await api.functions.invoke("adminPages",{action:mode,...(page?{id:page.id}:{}),page:payload});
   if(!response.data?.page)throw Error("page_save_failed");
   setPage(response.data.page);
   for(const [key,value] of Object.entries({...basics,brand_name:payload.brand_label})){
    const existing=settings.find(row=>row.key===key),data={value:value.trim().replace(key==="app_base_url"?/\/$/:/$^/,"")};
    const saved=existing?await api.entities.Setting.update(existing.id,data):await api.entities.Setting.create({key,...data});
    setSettings(previous=>[...previous.filter(row=>row.key!==key),saved]);
   }
   await load();setIntegrationRevision(v=>v+1);
   setNotice(mode==="publish"?copy("Votre page publique est à jour.","Your public page is up to date."):copy("Brouillon enregistré. Publiez la page pour la rendre disponible.","Draft saved. Publish the page to make it available."));
  }catch(e){setError(e.response?.data?.error?.startsWith("pages_")?copy("La page doit avoir un rendez-vous actif, un titre et un bouton pour chaque langue affichée. Vérifiez aussi les URLs des images.","The page needs an active appointment type, a headline and a button for each displayed language. Check image URLs too."):copy("L’enregistrement n’a pas été entièrement terminé. Votre saisie reste visible ; réessayez.","Saving did not fully complete. Your edits remain visible; please retry."));}
  finally{setBusy(false);}
 }
 async function pause(){
  if(busy || !page)return;
  if(!window.confirm(copy("Mettre la page en pause ? Les réservations existantes seront conservées.","Pause this page? Existing bookings will be kept.")))return;
  setBusy(true);setError("");setNotice("");
  try{await api.functions.invoke("adminPages",{action:"unpublish",id:page.id});setPage(previous=>({...previous,status:"draft"}));setNotice(copy("Page en pause. Les rendez-vous existants sont conservés.","Page paused. Existing appointments are kept."));}
  catch{setError(copy("Impossible de mettre la page en pause.","Unable to pause the page."));}
  finally{setBusy(false);}
 }
 async function copyLink(){
  try{await navigator.clipboard.writeText(basics.app_base_url);setNotice(copy("Lien copié.","Link copied."));}
  catch{setError(copy("Copie impossible. Sélectionnez l’adresse ci-dessus.","Unable to copy. Select the address above."));}
 }
 const publicUrl=validPublicUrl(basics.app_base_url)?basics.app_base_url:"";
 if(loading && !form)return <p role="status">{copy("Chargement de Ma page…","Loading My page…")}</p>;
 return <div className="space-y-10">
  <header className="flex flex-wrap justify-between items-start gap-3"><div><h1 className="font-heading text-3xl">{copy("Ma page","My page")}</h1><p className="text-sm text-muted-foreground mt-2">{copy("Les réglages de votre page d’accueil de réservation (/). Les autres pages se gèrent dans les options avancées.","Settings for your booking homepage (/). Other pages are managed in advanced options.")}</p></div><button disabled={busy || loading} className={button} onClick={()=>{if(!dirty || window.confirm(copy("Abandonner les modifications non enregistrées ?","Discard unsaved changes?")))load();}}><RefreshCw className="w-4 h-4"/>{copy("Actualiser","Refresh")}</button></header>
  {error && <p role="alert" className="rounded-xl border p-4 text-sm text-destructive">{error}</p>}
  {notice && <p role="status" className="rounded-xl border p-4 text-sm text-primary">{notice}</p>}
  {form && <form onSubmit={save} className="rounded-2xl border bg-card p-4 sm:p-6 space-y-6">
   <div className="flex flex-wrap justify-between items-center gap-3"><h2 className="font-heading text-xl">{copy("Ma page de réservation","My booking page")}</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs">{page?.status==="published" && form.active?copy("Publiée","Published"):copy("Brouillon / en pause","Draft / paused")}</span></div>
   <fieldset disabled={busy || loading} className="space-y-5">
    <div className="grid sm:grid-cols-2 gap-4">
     <label className="text-sm">{copy("Nom de votre activité","Business name")}<input required maxLength={100} className={input} value={form.brand_label || ""} onChange={e=>set("brand_label",e.target.value)}/></label>
     <label className="text-sm">{copy("Logo — adresse de l’image","Logo image address")}<input type="url" className={input} placeholder="https://…" value={form.logo_url || ""} onChange={e=>set("logo_url",e.target.value)}/></label>
     <label className="text-sm">{copy("Adresse publique de l’application","Public application address")}<input required type="url" className={input} value={basics.app_base_url} onChange={e=>setBasics({...basics,app_base_url:e.target.value})}/></label>
     <label className="text-sm">{copy("Fuseau de vos horaires","Working hours timezone")}<input required className={input} value={basics.reference_timezone} onChange={e=>setBasics({...basics,reference_timezone:e.target.value})}/></label>
     <label className="text-sm">{copy("Langue de la page","Page language")}<select className={input} value={form.language_mode} onChange={e=>set("language_mode",e.target.value)}><option value="auto">{copy("Français et anglais, selon le visiteur","French and English, based on visitor")}</option><option value="fr">Français</option><option value="en">English</option></select></label>
     <label className="text-sm">{copy("Couleur d’accent","Accent color")}<select className={input} value={form.accent_style} onChange={e=>set("accent_style",e.target.value)}>{["terracotta","sage","blue","plum"].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <label className="block text-sm">{copy("Dépôt GitHub — bouton sur la homepage (facultatif)","GitHub repository — homepage button (optional)")}<input type="url" maxLength={250} className={input} placeholder="https://github.com/organisation/repository" value={form.github_repo_url || ""} onChange={e=>set("github_repo_url",e.target.value)}/><span className="block mt-1 text-xs text-muted-foreground">{copy("Le bouton GitHub est masqué tant que l’adresse du dépôt n’est pas renseignée.","The GitHub button stays hidden until the repository URL is provided.")}</span></label>
    <div className="grid lg:grid-cols-2 gap-5">{(form.language_mode==="auto"?["fr","en"]:[form.language_mode]).map(language=><section key={language} className="space-y-3"><h3 className="text-sm font-semibold">{language==="fr"?"Français":"English"}</h3>{[["eyebrow",copy("Petit texte au-dessus du titre (facultatif)","Small label above the headline (optional)")],["headline",copy("Titre","Headline")],["subtitle",copy("Présentation","Introduction")],["primary_cta",copy("Texte du bouton","Button text")]].map(([key,label])=><label key={key} className="block text-sm">{label}<input required={["headline","primary_cta"].includes(key)} maxLength={1000} className={input} value={form[key+"_"+language] || ""} onChange={e=>set(key+"_"+language,e.target.value)}/></label>)}</section>)}</div>
    <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">{copy("Autres textes et visuels de la homepage","More homepage text and visuals")}</summary><div className="mt-4 space-y-4">{[["hero_visual_url",copy("Image du hero — adresse HTTPS","Hero image — HTTPS address")],["context_icon",copy("Icône de la page","Page icon")]].map(([key,label])=><label key={key} className="block text-sm">{label}<input className={input} value={form[key] || ""} onChange={e=>set(key,e.target.value)}/></label>)}<div className="grid lg:grid-cols-2 gap-5">{(form.language_mode==="auto"?["fr","en"]:[form.language_mode]).map(language=><section key={language} className="space-y-3"><h3 className="text-sm font-semibold">{language==="fr"?"Français":"English"}</h3>{[["intro_text",copy("Texte complémentaire","Additional introduction")],["secondary_copy",copy("Texte avant le choix du rendez-vous","Text before choosing an appointment")],["footer_text",copy("Pied de page","Footer")],["meta_title",copy("Titre de l’onglet du navigateur","Browser tab title")],["meta_description",copy("Description pour les moteurs de recherche","Search engine description")]].map(([key,label])=><label key={key} className="block text-sm">{label}<textarea className={input} rows={2} value={form[key+"_"+language] || ""} onChange={e=>set(key+"_"+language,e.target.value)}/></label>)}</section>)}</div></div></details>
    <section className="space-y-3"><h3 className="text-sm font-semibold">{copy("Rendez-vous proposés","Offered appointments")}</h3>{types.filter(type=>type.active || form.booking_type_ids.includes(type.id)).map(type=><label key={type.id} className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={form.booking_type_ids.includes(type.id) && !(form.type_overrides || []).some(o=>o.booking_type_id===type.id && o.visible===false)} onChange={e=>{const ids=e.target.checked?[...new Set([...form.booking_type_ids,type.id])]:form.booking_type_ids.filter(id=>id!==type.id);setForm(previous=>({...previous,booking_type_ids:ids,default_booking_type_id:ids.includes(previous.default_booking_type_id)?previous.default_booking_type_id:"",type_overrides:(previous.type_overrides || []).map(o=>o.booking_type_id===type.id?{...o,visible:true}:o)}));}}/><span>{localizedField(type,"name",locale)} · {type.duration} min {!type.active && copy("(inactif)","(inactive)")}</span></label>)}{!types.length && <p className="text-sm text-muted-foreground">{copy("Créez d’abord un type de rendez-vous dans la section Rendez-vous.","Create an appointment type first in Appointment types.")}</p>}</section>
    <div className="flex flex-wrap gap-3">{publicUrl && <><a className={button} href="/" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4"/>{copy("Voir ma page","View my page")}</a><button type="button" onClick={copyLink} className={button}><Copy className="w-4 h-4"/>{copy("Copier mon lien","Copy my link")}</button></>}</div>
    {publicUrl && <p className="text-xs break-all text-muted-foreground">{publicUrl}</p>}
   </fieldset>
   {dirty && <p className="text-xs text-muted-foreground">{copy("Modifications non enregistrées","Unsaved changes")}</p>}
   <div className="flex flex-wrap gap-3 border-t pt-4"><button type="submit" value="save" disabled={busy || loading} className={button + " bg-primary text-primary-foreground"}>{busy?<Loader2 className="w-4 h-4 animate-spin"/>:null}{copy(page?.status==="published"?"Enregistrer et mettre à jour":"Enregistrer",page?.status==="published"?"Save and update":"Save")}</button>{page?.status!=="published" && <button type="submit" value="publish" disabled={busy || loading} className={button}>{copy("Publier ma page","Publish my page")}</button>}{page?.status==="published" && <button type="button" disabled={busy || loading} onClick={pause} className={button}>{copy("Mettre en pause","Pause page")}</button>}</div>
  </form>}
  <IntegrationSettings key={integrationRevision}/>
  <section className="rounded-2xl border p-4"><button type="button" className={button} aria-expanded={advanced} onClick={()=>{setAdvancedVisited(true);setAdvanced(v=>!v);}}>{copy("Options avancées : pages multiples et personnalisation","Advanced: multiple pages and customization")}</button><p className="text-xs text-muted-foreground mt-2">{copy("Les pages supplémentaires ont leurs propres textes et liens. La page d’accueil se règle uniquement ci-dessus.","Additional pages have their own text and links. Manage the homepage only in the form above.")}</p><div hidden={!advanced} className="mt-5">{advancedVisited && <PagesTab active={advanced} additionalPagesOnly/>}</div></section>
 </div>;
}
