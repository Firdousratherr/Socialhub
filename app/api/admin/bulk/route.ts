import { NextResponse } from "next/server";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-permissions";
const schema=z.object({userIds:z.array(z.string().min(1)).min(1).max(100),action:z.enum(["ENABLE","DISABLE","VERIFY","UNVERIFY","REVOKE_SESSIONS"])});
export async function POST(request:Request){
 const access=await requireAdminPermission("USERS_BULK"); if(access.response)return access.response;
 const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:"Invalid bulk operation."},{status:400});
 const {userIds,action}=parsed.data;
 if(userIds.includes(access.user.id)&&action==="DISABLE")return NextResponse.json({error:"You cannot disable your own administrator account."},{status:400});
 if(action==="REVOKE_SESSIONS") await prisma.session.deleteMany({where:{userId:{in:userIds}}});
 else {
   const data=action==="ENABLE"?{isActive:true}:action==="DISABLE"?{isActive:false}:action==="VERIFY"?{isVerified:true,verifiedAt:new Date()}:{isVerified:false,verifiedAt:null};
   await prisma.user.updateMany({where:{id:{in:userIds},isOwner:action==="VERIFY"?undefined:false},data});
 }
 await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"BULK_USER_"+action,targetType:"USER_BATCH",details:JSON.stringify({userIds,count:userIds.length})}});
 return NextResponse.json({ok:true,count:userIds.length});
}
