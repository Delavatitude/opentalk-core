import {useState} from "react";
import {api} from "@/api/client";
import {useI18n} from "@/i18n/I18nContext";
import {Video,Loader2} from "lucide-react";
export default function MeetingAccess({booking,token}){
 const {t}=useI18n();
 const [url,setUrl]=useState(booking.meeting_url || ""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const safeUrl=/^https:\/\//i.test(url)?url:"";
 async function prepare(){
  setBusy(true);setError("");
  try{
   await api.functions.invoke("prepareBookingMeeting",{token});
   const r=await api.functions.invoke("getBookingByToken",{token});
   setUrl(r.data.booking.meeting_url || "");
   if(!r.data.booking.meeting_url)setError("meeting_access_unavailable");
  }catch{setError("meeting_access_unavailable");}finally{setBusy(false);}
 }
 if(booking.status==="cancelled")return null;
 if(safeUrl)return <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="w-full mt-5 bg-primary text-white font-semibold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2"><Video className="w-4 h-4" aria-hidden="true"/>{t("meeting_access_join")}</a>;
 if(booking.location_type!=="google_meet")return booking.location_value?<p className="mt-4 text-sm break-words">{booking.location_value}</p>:null;
 return <section className="mt-5 rounded-xl border p-4 space-y-3"><p className="text-sm">{t("meeting_access_pending")}</p><button type="button" disabled={busy} onClick={prepare} className="w-full rounded-xl bg-primary text-white py-3 px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-40">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Video className="w-4 h-4"/>}{t(busy?"loading":"meeting_access_prepare")}</button>{error && <p role="alert" className="text-sm">{t(error)}</p>}</section>;
}
