export function secureResponse(request:Request,response:Response) {
  const result=new Response(response.body,response);
  result.headers.set('x-content-type-options','nosniff');
  result.headers.set('referrer-policy','no-referrer');
  result.headers.set('content-security-policy',"object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com");
  const path=new URL(request.url).pathname;
  if(path==='/'||path.startsWith('/api/'))result.headers.set('cache-control','private, no-store');
  return result;
}
