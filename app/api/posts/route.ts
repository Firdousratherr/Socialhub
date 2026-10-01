import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postInputSchema } from "@/lib/validation";
import { getBlockedUserIds } from "@/lib/social-access";

async function getSession() { return auth.api.getSession({ headers: await headers() }); }
function parseCursor(value:string|null){if(!value)return null;try{const p=JSON.parse(Buffer.from(value,"base64url").toString("utf8")) as {createdAt?:string;id?:string};if(!p.createdAt||!p.id)return null;const d=new Date(p.createdAt);return Number.isNaN(d.getTime())?null:{createdAt:d,id:p.id};}catch{return null;}}
function encodeCursor(createdAt:Date,id:string){return Buffer.from(JSON.stringify({createdAt:createdAt.toISOString(),id}),"utf8").toString("base64url");}

export async function GET(request:Request){
 const url=new URL(request.url),take=Math.min(Math.max(Number(url.searchParams.get("take")??20),1),50),cursor=parseCursor(url.searchParams.get("before"));
 const mode=url.searchParams.get("mode")??"FOR_YOU",feedMode=new Set(["FOR_YOU","FOLLOWING","FRIENDS","LATEST","SAVED"]).has(mode)?mode:"FOR_YOU";
 const session=await getSession();let blockedIds:string[]=[],friendIds:string[]=[],followingIds:string[]=[];
 if(session?.user){blockedIds=await getBlockedUserIds(session.user.id);friendIds=(await prisma.friendRequest.findMany({where:{status:"ACCEPTED",OR:[{senderId:session.user.id},{receiverId:session.user.id}]},select:{senderId:true,receiverId:true}})).map(r=>r.senderId===session.user.id?r.receiverId:r.senderId);followingIds=(await prisma.follow.findMany({where:{followerId:session.user.id},select:{followingId:true}})).map(r=>r.followingId);}
 const posts=await prisma.post.findMany({where:{AND:[...(cursor?[{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{lt:cursor.id}}]}]:[]),{OR:[{visibility:"PUBLIC"},...(session?.user?[{authorId:session.user.id},...(friendIds.length?[{visibility:"FRIENDS" as const,authorId:{in:friendIds}}]:[])]:[])}],author:{isActive:true,...(blockedIds.length?{id:{notIn:blockedIds}}:{})},...(feedMode==="FOLLOWING"?{authorId:{in:session?.user?followingIds:[]}}:{}),...(feedMode==="FRIENDS"?{authorId:{in:session?.user?[...friendIds,session.user.id]:[]}}:{}),...(feedMode==="SAVED"?{savedBy:session?.user?{some:{userId:session.user.id}}:{some:{userId:"__signed_out__"}}}:{} )},orderBy:[{createdAt:"desc"},{id:"desc"}],take,include:{author:{select:{id:true,name:true,username:true,image:true}},_count:{select:{likes:true,comments:true}}}});
 const ids=posts.map(p=>p.id),[likedRows,savedRows]=session?.user&&ids.length?await Promise.all([prisma.like.findMany({where:{userId:session.user.id,postId:{in:ids}},select:{postId:true}}),prisma.savedPost.findMany({where:{userId:session.user.id,postId:{in:ids}},select:{postId:true}})]):[[],[]];
 const liked=new Set(likedRows.map(r=>r.postId)),saved=new Set(savedRows.map(r=>r.postId));
 return NextResponse.json({posts:posts.map(p=>({...p,liked:liked.has(p.id),saved:saved.has(p.id)})),nextBefore:posts.length===take?encodeCursor(posts.at(-1)!.createdAt,posts.at(-1)!.id):null});
}
export async function POST(request:Request){const session=await getSession();if(!session?.user)return NextResponse.json({error:"Authentication required."},{status:401});const parsed=postInputSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Invalid post."},{status:400});const post=await prisma.post.create({data:{authorId:session.user.id,content:parsed.data.content??null,mediaUrl:parsed.data.mediaUrl??null,visibility:parsed.data.visibility},include:{author:{select:{id:true,name:true,username:true,image:true}},_count:{select:{likes:true,comments:true}}}});return NextResponse.json({post,liked:false,saved:false},{status:201});}
