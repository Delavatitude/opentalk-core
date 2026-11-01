import {useCallback,useEffect,useState} from "react";
import {api} from "@/api/client";
import {useI18n} from "@/i18n/I18nContext";
import {CalendarDays,Mail,RefreshCw} from "lucide-react";
import CalendarsTab from "./CalendarsTab";
const button="min-h-11 rounded-xl border px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-secondary disabled:opacity-50";

export default function IntegrationSettings(){
 const {locale}=useI18n(),fr=locale==="fr",copy=(a,b)=>fr?a:b;
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const [showCalendars,setShowCalendars]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError(false);
  try{const response=await api.functions.invoke("adminIntegrationStatus",{});setStatus(response.data);}
  catch{setError(true);setStatus(null);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 return <section id="integrations" className="scroll-mt-6 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-heading text-2xl">{copy("Agendas et emails","Calendars and email")}</h2><p className="text-sm text-muted-foreground mt-1">{copy("Facultatif : les réservations avec lieu personnalisé fonctionnent sans intégration.","Optional: bookings with a custom location work without integrations.")}</p></div><button type="button" disabled={loading} onClick={load} className={button}><RefreshCw className="w-4 h-4"/>{copy("Actualiser les états","Refresh status")}</button></div>
  {error && <p role="alert" className="text-sm text-destructive">{copy("Impossible de vérifier les intégrations. Réessayez ; aucun état connecté n’est supposé.","Unable to check integrations. Retry; no connected state is assumed.")}</p>}
  <div className="grid lg:grid-cols-2 gap-4">
   <article className="rounded-2xl border bg-card p-5 space-y-3">
    <div className="flex justify-between items-start gap-3"><h3 className="font-semibold inline-flex items-center gap-2"><CalendarDays className="w-5 h-5"/>Google Calendar</h3><span className="text-xs rounded-full bg-secondary px-3 py-1">{loading?copy("Vérification…","Checking…"):!status?copy("État inconnu","Unknown"):status.google?.authorized?copy("Autorisation détectée","Authorization detected"):copy("Non connecté","Not connected")}</span></div>
    <p className="text-sm text-muted-foreground">{copy("Importe les indisponibilités, crée les événements et permet les liens Google Meet.","Imports busy periods, creates events and enables Google Meet links.")}</p>
    <p className="rounded-xl bg-secondary p-3 text-sm">{copy("La connexion aux agendas n’est pas disponible dans cette version. Utilisez un lieu personnalisé ou un lien de visioconférence existant.","Calendar connections are not available in this version. Use a custom location or an existing video meeting link.")}</p>

   </article>
   <article className="rounded-2xl border bg-card p-5 space-y-3">
    <div className="flex justify-between items-start gap-3"><h3 className="font-semibold inline-flex items-center gap-2"><Mail className="w-5 h-5"/>Resend</h3><span className="text-xs rounded-full bg-secondary px-3 py-1">{loading?copy("Vérification…","Checking…"):!status?copy("État inconnu","Unknown"):status.resend?.configured?copy("Configuration détectée","Configuration detected"):copy("Emails non configurés","Email not configured")}</span></div>
    <p className="text-sm text-muted-foreground">{copy("Envoie les confirmations, modifications, annulations et rappels. La présence d’une clé ne prouve pas la livraison des emails.","Sends confirmations, changes, cancellations and reminders. A configured key does not prove email delivery.")}</p>
    {status && !status.resend?.configured && <p className="rounded-xl bg-secondary p-3 text-sm">{copy("Les rendez-vous restent enregistrés. Ne comptez pas sur les emails tant que cette configuration n’est pas terminée.","Appointments are still saved. Do not rely on email until setup is complete.")}</p>}
    <details className="text-sm"><summary className="cursor-pointer min-h-11 inline-flex items-center">{copy("Configurer mes emails","Configure email")}</summary><ol className="list-decimal pl-5 space-y-2 mt-2"><li>{copy("Dans Resend, ajoutez votre domaine d’expédition et faites-le vérifier.","Add and verify your sending domain in Resend.")}</li><li>{copy("Créez une clé API d’envoi pour cette instance.","Create a sending API key for this instance.")}</li><li>{copy("Demandez à l’administrateur du serveur de configurer RESEND_API_KEY et RESEND_FROM (ex. Mon activité <rdv@mon-domaine.fr>).","Ask the server administrator to configure RESEND_API_KEY and RESEND_FROM (e.g. My business <booking@my-domain.com>).")}</li><li>{copy("Enregistrez l’adresse publique de Ma page, puis actualisez l’état ici.","Save the public address under My page, then refresh status here.")}</li></ol><p className="text-xs text-muted-foreground mt-3">{copy("La clé est configurée côté serveur. Elle n’est jamais stockée dans les réglages publics ni affichée ici. La vérification du domaine se fait dans Resend.","The key is configured on the server. It is never stored in public settings or displayed here. Verify the domain in Resend.")}</p></details>
    {status?.resend && <ul className="text-xs text-muted-foreground space-y-1">{[
     [status.resend.key_configured,copy("Clé serveur","Server key")],
     [status.resend.sender_configured,copy("Adresse d’expédition","Sender address")],
     [status.resend.public_url_configured,copy("Adresse publique HTTPS","Public HTTPS address")]
    ].map(([ok,label])=><li key={label}>{label} : {ok?copy("renseignée","present"):copy("à renseigner","missing")}</li>)}</ul>}
   </article>
  </div>
  {showCalendars && <CalendarsTab/>}
 </section>;
}
