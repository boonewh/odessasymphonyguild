import test from 'node:test';
import assert from 'node:assert/strict';
import OAuthClient from 'intuit-oauth';
import {oauthCallbackForTokenExchange} from '../lib/quickbooks/oauth-callback.ts';

test('OAuth normalization preserves token fields and prevents callback redirect override',async()=>{
  const callback='https://example.com/callback?code=a%2Bb%26c&realmId=123&state=state%2Bvalue&redirectUri=https://untrusted.example&unused=%FF';
  const safe=oauthCallbackForTokenExchange(callback);
  const client=new OAuthClient({clientId:'test',clientSecret:'test',environment:'sandbox',redirectUri:'https://example.com/callback'});
  let sent;client.getTokenRequest=async request=>{sent=request;return{json:{access_token:'fictional',refresh_token:'fictional',expires_in:3600}};};
  await client.createToken(safe);
  assert.equal(sent.data.code,'a+b&c');assert.equal(sent.data.redirect_uri,'https://example.com/callback');
  assert.equal(client.token.realmId,'123');assert.equal(client.token.state,'state+value');
  assert.ok(!safe.includes('redirectUri'));assert.ok(!safe.includes('unused'));
});
test('OAuth normalization converts malformed percent escapes before the legacy decoder sees them',()=>{
  const safe=oauthCallbackForTokenExchange('https://example.com/callback?code=%FF%FE%ZZ%&realmId=123&state=%E0%A4%A');
  assert.doesNotThrow(()=>decodeURIComponent(new URL(safe).search.slice(1)));
  assert.equal(new URL(safe).searchParams.get('code'),'\uFFFD\uFFFD%ZZ%');
});
test('OAuth callback size and ambiguous fields are rejected before token exchange',()=>{
  for(const uri of ['https://example.com/?code='+('%FF'.repeat(2000))+'&realmId=123',
    'https://example.com/?code=a&code=b&realmId=123','https://example.com/?code=a',
    'https://example.com/?code=a&realmId=123&state='+('x'.repeat(513)),'file:///tmp?code=a&realmId=123'])
    assert.throws(()=>oauthCallbackForTokenExchange(uri));
});
