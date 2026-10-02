import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";
export async function GET(){
 const access=await requireAdmin(); if(access.response)return access.response;
 const started=Date.now(); let db="healthy"; let counts:any={};
 try{ counts=await prisma.$transaction([prisma.user.count(),prisma.post.count(),prisma.message.count()]); }catch{db="error";}
 const env={database:Boolean(process.env.DATABASE_URL),authSecret:Boolean(process.env.BETTER_AUTH_SECRET||process.env.AUTH_SECRET),blob:Boolean(process.env.BLOB_READ_WRITE_TOKEN),smtp:Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER)};
 return NextResponse.json({database:db,latencyMs:Date.now()-started,counts:{users:counts[0]??0,posts:counts[1]??0,messages:counts[2]??0},configuration:env,time:new Date().toISOString()});
}
