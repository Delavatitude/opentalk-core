import {useState,useEffect,useRef} from "react";
import {parsePhoneNumberFromString,getCountries,getCountryCallingCode} from "libphonenumber-js";
import {useI18n} from "@/i18n/I18nContext";
export function phoneDetails(value) {
  const raw=String(value || "").replace(/^00/,"+");
  const phone=parsePhoneNumberFromString(raw,{extract:false});
  return phone?.isPossible()?{number:phone.number,display:phone.formatInternational(),code:"+"+phone.countryCallingCode,country:phone.country || ""}:null;
}
export default function PhoneInput({value="",onChange,required=false,id,className=""}) {
  const {t,locale}=useI18n(),ref=useRef(null);
  const [country,setCountry]=useState(()=>phoneDetails(value)?.country || "FR");
  const parsed=parsePhoneNumberFromString(String(value).replace(/^00/,"+"),{defaultCountry:country,extract:false});
  useEffect(()=>{const detected=phoneDetails(value)?.country;if(detected)setCountry(detected);},[value]);
  const valid=!value.trim() || !!parsed?.isPossible();
  useEffect(()=>{ref.current?.setCustomValidity(valid?"":t("phone_invalid"));},[valid,t]);
  const labels=new Intl.DisplayNames([locale],{type:"region"});
  function change(raw,region=country) {
    const p=parsePhoneNumberFromString(raw.replace(/^00/,"+"),{defaultCountry:region,extract:false});
    if(p?.isPossible()){if(p.country)setCountry(p.country);onChange(p.number);}else onChange(raw);
  }
  return <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-2 min-w-0">
    <select aria-label={t("phone_country")} className={className} value={country} onChange={e=>{const region=e.target.value;setCountry(region);if(value){const local=parsed?.nationalNumber || value;change(local,region);}}}>
      {getCountries().sort((a,b)=>labels.of(a).localeCompare(labels.of(b),locale)).map(c=><option key={c} value={c}>{labels.of(c)} (+{getCountryCallingCode(c)})</option>)}
    </select><input ref={ref} id={id} aria-label={t("crm_phone")} type="tel" autoComplete="tel" required={required} className={className} value={value} onChange={e=>change(e.target.value)} placeholder={country==="FR"?"06 12 34 56 78":"+1 202 555 0123"}/>
  </div>;
}
