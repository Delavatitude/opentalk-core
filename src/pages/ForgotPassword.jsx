import AuthLayout from "@/components/AuthLayout";
import {Link} from "react-router-dom";
export default function Page(){return <AuthLayout title="Account recovery"><p>Contact the operator of this installation to reset your password.</p><Link to="/login">Log in</Link></AuthLayout>;}
