import {parsePhoneNumberFromString} from "libphonenumber-js";
export function phoneProfile(value) {
  const raw=String(value || "").trim();
  const phone=parsePhoneNumberFromString(raw.replace(/^00/,"+"),{extract:false});
  if(phone?.isPossible())return {phone:phone.number,phone_country:phone.country || "",phone_calling_code:"+"+phone.countryCallingCode};
  // Preserve legacy national numbers until their country is explicitly selected.
  return {phone:raw,phone_country:"",phone_calling_code:""};
}
