const assert = require('node:assert/strict');
const { generateKeyPairSync, sign, createHmac } = require('node:crypto');
const { test } = require('node:test');
const nock = require('nock');
const issuer = 'https://discord.test/realms/m2m';
Object.assign(process.env, { M2M_PROVIDER:'keycloak', KEYCLOAK_ISSUER:issuer,
  KEYCLOAK_AUDIENCE:'https://api.test',KEYCLOAK_TOKEN_URL:'https://discord.test/m2m/token',
  DISCORD_BOT_TOKEN:'synthetic-discord-secret',VERIFY_REDIRECT_URL:'https://fixture.test/done',AUTH_SECRET:'synthetic-member-secret',VALID_ISSUERS:'["https://member.test/"]',AUTH_USER_AUDIENCES:'["member-api"]' });
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const {verifyToken}=require('../dist/services/verifyToken');
/** Generate signed member/service fixtures with changes; returns synthetic JWT text. */
function token(changes={},machine=false) {
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify(machine?{alg:'RS256',kid:'discord'}:{alg:'HS256'})).toString('base64url');
 const claims=machine?{iss:issuer,aud:'https://api.test',sub:'service-discord',azp:'discord-test',gty:'client-credentials',scope:'read:groups'}:
  {iss:'https://member.test/',aud:'member-api',userId:123,roles:['Topcoder User'],handle:'fixture'};
 const payload=Buffer.from(JSON.stringify({...claims,iat:now,exp:now+900,...changes})).toString('base64url');
 const input=`${header}.${payload}`;
 return `${input}.${machine?sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url'):createHmac('sha256','synthetic-member-secret').update(input).digest('base64url')}`;
}
nock(issuer).persist().get('/protocol/openid-connect/certs').reply(200,{keys:[{...publicKey.export({format:'jwk'}),kid:'discord',alg:'RS256',use:'sig'}]});
test('compiled verifier normalizes members and strips service permissions',async()=>{
 const member=await verifyToken(token({scope:'write:bus_api'}));assert.equal(member.kind,'user');assert.equal(member.userId,123);assert.equal(member.handle,'fixture');assert.deepEqual(member.scopes,[]);
});
test('compiled verifier rejects machine tokens, nickname-only members and conflicting claims',async()=>{
 for(const candidate of [token({},true),token({roles:['administrator']},true),token({handle:undefined,nickname:'fixture'}),token({userId:undefined}),token({'https://topcoder-dev.com/claims/userId':456}),token({iss:'https://member.test/evil'}),token({aud:'other'}),'not-a-token',undefined]) {
  await assert.rejects(verifyToken(candidate),/^Error: Invalid or expired member token$/);
 }
});
test('member management middleware uses the same normalized principal',async()=>{
 const express=require('express');const {middleware}=require('tc-core-library-js');const app=express();
 app.get('/manage',middleware.jwtAuthenticator(),(req,res)=>{
  if(!req.authUser.roles.includes('administrator')) return res.status(403).end();
  res.json({kind:req.authUser.kind,userId:req.authUser.userId});
 });
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}/manage`;
 try {
  let response=await fetch(url,{headers:{authorization:'Bearer '+token({roles:['administrator']})}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{kind:'user',userId:123});
  response=await fetch(url,{headers:{authorization:'Bearer '+token({},true)}});assert.equal(response.status,403);
  response=await fetch(url,{headers:{authorization:'Bearer '+token()}});assert.equal(response.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('actual linking callback uses only normalized member handle and blocks services before integrations',async()=>{
 const db={Member:{create:async record=>{saved=record;}}};let saved;let context;let requests=0;
 const env=require('../dist/services/env').Env;
 const jwt=require('jsonwebtoken');
 const servicesPath=require.resolve('../dist/services');
 require.cache[servicesPath]={id:servicesPath,filename:servicesPath,loaded:true,exports:{Env:env,verifyToken,Logger:{info(){},error(){}},HttpService:class {
  async get(url){requests++;assert.ok(url.endsWith('/v6/members/fixture'));return {json:async()=>({maxRating:{rating:0}})};}
 }}};
 const commandsPath=require.resolve('../dist/commands');require.cache[commandsPath]={id:commandsPath,filename:commandsPath,loaded:true,exports:{}};
 const dbPath=require.resolve('../dist/models/db');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{__esModule:true,default:db}};
 const {RootController}=require('../dist/controllers/root-controller');
 const controller=new RootController({broadcastEval:async(fn,options)=>{context=options.context;return [{success:true,member:{nickname:'fixture',user:{id:'123456789012345678',username:'fixture',discriminator:'0'}}}];}});
 const discord=jwt.sign({data:{userId:'123456789012345678'}},env.token,{algorithm:'HS256',expiresIn:300});
 let status,redirect;const res={status:code=>{status=code;return res},send:()=>{},json:()=>{},redirect:url=>{redirect=url;}};
 await controller.verifyUser({query:{discord,token:token()}},res);
 assert.equal(saved.tcHandle,'fixture');assert.equal(context.memberHandle,'fixture');assert.equal(context.decodedToken,undefined);assert.equal(redirect,'https://fixture.test/done');assert.equal(requests,1);
 await controller.verifyUser({query:{discord,token:token({},true)}},res);assert.equal(status,400);assert.equal(requests,1);
});
