import {defineRailway,github,project,service,volume} from 'railway/iac';

// Public deployment metadata, never credentials. Required to avoid guessing an account.
export default defineRailway(ctx=>{
  const repo=process.env.COTIZA_GITHUB_REPOSITORY||'studioelpantojita/cotizasweet';
  const region=process.env.COTIZA_RAILWAY_REGION||'';
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('Set COTIZA_GITHUB_REPOSITORY to the verified owner/repository.');
  if(!/^[a-z0-9-]+$/.test(region))throw new Error('Set COTIZA_RAILWAY_REGION to an available Railway region.');
  const webData=volume('web-data',{region,sizeMB:1024});
  const quotesData=volume('quotes-data',{region,sizeMB:1024});
  const baseDeploy={region,numReplicas:1,restartPolicyType:'ON_FAILURE' as const,restartPolicyMaxRetries:10};
  const source=()=>github(repo,{branch:'main',checkSuites:true});
  const ruc=service('api-python',{
    source:source(),build:{builder:'DOCKERFILE',dockerfilePath:'api-python/Dockerfile'},
    healthcheck:'/health',healthcheckTimeout:120,
    deploy:{...baseDeploy,limitOverride:{containers:{cpu:.5,memoryBytes:512*1024*1024}}},
    env:{APP_ENV:'production',PORT:'8000',RUC_PROVIDER:'decolecta',RUC_API_TOKEN:ctx.shared.RUC_API_TOKEN,INTEGRATION_SERVICE_KEY:ctx.shared.INTEGRATION_SERVICE_KEY,OIDC_ALLOW_LOCAL_HTTP:'false',RAILWAY_RUN_UID:'0'},
  });
  const api=service('api-dotnet',{
    source:source(),build:{builder:'DOCKERFILE',dockerfilePath:'api-dotnet/Dockerfile'},
    healthcheck:'/health',healthcheckTimeout:120,volumeMounts:{'/app/data':quotesData},
    deploy:{...baseDeploy,limitOverride:{containers:{cpu:.5,memoryBytes:512*1024*1024}}},
    env:{ASPNETCORE_ENVIRONMENT:'Production',PORT:'8000',ASPNETCORE_HTTP_PORTS:'8000',DATABASE_PATH:'/app/data/cotiza.sqlite',OIDC_ISSUER:ctx.shared.OIDC_ISSUER,OIDC_AUDIENCE:ctx.shared.OIDC_AUDIENCE,INTEGRATION_SERVICE_KEY:ctx.shared.INTEGRATION_SERVICE_KEY,RUC_SERVICE_URL:'http://api-python.railway.internal:8000',OIDC_ALLOW_LOCAL_HTTP:'false',RAILWAY_RUN_UID:'0'},
  });
  const web=service('web',{
    source:source(),build:{builder:'DOCKERFILE',dockerfilePath:'web/Dockerfile'},
    healthcheck:'/api/health',healthcheckTimeout:120,volumeMounts:{'/app/data':webData},
    deploy:{...baseDeploy,limitOverride:{containers:{cpu:1,memoryBytes:1024*1024*1024}}},
    env:{NODE_ENV:'production',PORT:'3000',HOSTNAME:'0.0.0.0',APP_ORIGIN:ctx.shared.APP_ORIGIN,API_BACKEND:'dotnet',API_BASE_URL:'http://api-dotnet.railway.internal:8000',DATABASE_PATH:'/app/data/cotiza.sqlite',OIDC_ISSUER:ctx.shared.OIDC_ISSUER,OIDC_CLIENT_ID:ctx.shared.OIDC_CLIENT_ID,OIDC_CLIENT_SECRET:ctx.shared.OIDC_CLIENT_SECRET,OIDC_AUDIENCE:ctx.shared.OIDC_AUDIENCE,OIDC_SCOPE:'openid profile email quotes:read quotes:write',SESSION_SECRET:ctx.shared.SESSION_SECRET,INTEGRATION_SERVICE_KEY:ctx.shared.INTEGRATION_SERVICE_KEY,OIDC_ALLOW_LOCAL_HTTP:'false',TRUSTED_CLIENT_IP_HEADER:'',RAILWAY_RUN_UID:'0'},
  });
  return project('cotizasweet',{resources:[web,api,ruc,webData,quotesData]});
});
