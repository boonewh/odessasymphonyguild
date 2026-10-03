import test from 'node:test';
import assert from 'node:assert/strict';
import { clientReviewAllowed, clientReviewRequest } from '../lib/gala/client-review.ts';

test('client review requires both Vercel Preview and explicit opt-in', () => {
  assert.equal(clientReviewAllowed('preview', 'true'), true);
  for (const environment of [undefined, 'production', 'development', 'test']) {
    assert.equal(clientReviewAllowed(environment, 'true'), false);
  }
  for (const flag of [undefined, '', 'false', '1', 'TRUE']) {
    assert.equal(clientReviewAllowed('preview', flag), false);
  }
});

test('review host permits only designs and assets; blocks admin, APIs, other pages and submissions', () => {
  for (const path of ['/gala/tables', '/gala/gifts', '/gala/invitations', '/images/osg-logo.png', '/_next/static/chunk.js', '/_next/image', '/favicon.ico']) {
    assert.equal(clientReviewRequest(path, 'GET'), 'allowed');
    assert.equal(clientReviewRequest(path, 'HEAD'), 'allowed');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(clientReviewRequest(path, method), 'blocked');
  }
  for (const path of ['/gala/preview/admin', '/gala/preview/payment', '/api/gala/order', '/api/gala/session', '/api/gala/checkout', '/admin/login', '/api/admin/students', '/api/belles-beaux/submit', '/api/quickbooks/auth', '/api/quickbooks/webhook', '/belles-beaux/join', '/gala/tables/unknown']) {
    assert.equal(clientReviewRequest(path, 'GET'), 'blocked');
    assert.equal(clientReviewRequest(path, 'POST'), 'blocked');
  }
  assert.equal(clientReviewRequest('/', 'GET'), 'redirect');
  assert.equal(clientReviewRequest('/api/gala/assignments', 'GET'), 'blocked');
  assert.equal(clientReviewRequest('/api/gala/assignments', 'POST'), 'blocked');
  assert.equal(clientReviewRequest('/api/gala/gifts', 'GET'), 'blocked');
  assert.equal(clientReviewRequest('/api/gala/gifts', 'POST'), 'blocked');
  assert.equal(clientReviewRequest('/', 'POST'), 'blocked');
});
