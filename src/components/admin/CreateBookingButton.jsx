import {useState} from "react";
import {api} from "@/api/client";
import {useI18n} from "@/i18n/I18nContext";
import ContactMeetingDialog from "./ContactMeetingDialog";
export default function CreateBookingButton({onCreated}) {
  const {t}=useI18n();
  const [contacts,setContacts]=useState([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState("");
  async function launch() {
    setLoading(true);setMessage("");
    try {
      const rows=[];
      for(let offset=0;;offset+=100) {
        const page=await api.entities.Contact.filter({},"full_name",100,offset);
        rows.push(...page.filter(c=>!c.merged_into));
        if(page.length<100)break;
      }
      setContacts(rows);setOpen(true);
    } catch {setMessage("load_error");} finally {setLoading(false);}
  }
  return <div><button type="button" onClick={launch} disabled={loading} className="bg-primary text-white rounded-xl px-4 py-2 disabled:opacity-50">{t(loading?"loading":"crm_create_booking")}</button>
    {message && <p role="status" className="text-sm mt-2">{t(message)}</p>}
    {open && <ContactMeetingDialog contacts={contacts} mode="booking" onClose={()=>setOpen(false)} onCreated={()=>{setMessage("crm_booked");onCreated?.();}} />}
  </div>;
}
