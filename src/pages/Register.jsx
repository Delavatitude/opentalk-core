import AuthLayout from "@/components/AuthLayout";
import {Link} from "react-router-dom";
export default function Page(){return <AuthLayout title="Administrator access"><p>Accounts are managed by the operator of this installation. Contact them for access.</p><Link to="/login">Log in</Link></AuthLayout>;}
