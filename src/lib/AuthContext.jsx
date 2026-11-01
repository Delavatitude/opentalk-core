import {createContext,useContext,useEffect,useState} from 'react';
import {api} from '@/api/client';
const AuthContext=createContext();
export function AuthProvider({children}) {
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  const checkUserAuth=async()=>{try{setUser(await api.auth.me());}catch{setUser(null);}finally{setLoading(false);}};
  useEffect(()=>{checkUserAuth();},[]);
  return <AuthContext.Provider value={{user,isAuthenticated:!!user,isLoadingAuth:loading,isLoadingPublicSettings:false,authError:null,authChecked:!loading,appPublicSettings:{},checkUserAuth,checkAppState:checkUserAuth,logout:()=>api.auth.logout(),navigateToLogin:()=>api.auth.redirectToLogin()}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
