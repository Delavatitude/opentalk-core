import AuthLayout from "@/components/AuthLayout";
import {Link} from "react-router-dom";
export default function Page(){return <AuthLayout title="Account recovery"><p>Password recovery is managed by the operator of this installation.</p><Link to="/login">Log in</Link></AuthLayout>;}
