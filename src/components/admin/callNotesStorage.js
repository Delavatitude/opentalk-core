import {api} from '@/api/client';
async function load(booking){return {transcript:booking.call_transcript||'',summary:booking.call_summary||''};}
async function save(id,outcome,transcript,summary){
  return api.entities.Booking.update(id,{call_outcome:outcome,call_transcript:transcript,call_summary:summary,call_notes_file_uri:'',call_logged_at:new Date().toISOString()});
}
export default {load,save};
