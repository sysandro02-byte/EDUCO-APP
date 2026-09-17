import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const routes = fs.readFileSync(new URL('../server/academicDocuments.ts', import.meta.url), 'utf8');
const sidebar = fs.readFileSync(new URL('../components/Sidebar.tsx', import.meta.url), 'utf8');
const modal = fs.readFileSync(new URL('../components/AcademicDocumentsModal.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_academic_documents_workflow.sql', import.meta.url), 'utf8');

test('only DG and DE can manage academic reports and bulletins', () => {
  assert.match(routes, /DOCUMENT_MANAGERS = new Set\(\['Directeur Général', 'Directeur des Etudes'\]\)/);
  assert.match(routes, /assertManager\(actor\)/);
  assert.doesNotMatch(routes, /DOCUMENT_MANAGERS[^\n]+Promoteur/);
  assert.doesNotMatch(routes, /DOCUMENT_MANAGERS[^\n]+Directeur du Primaire/);
});

test('cashier access is limited to authorized or already printed bulletins', () => {
  assert.match(routes, /role === CASHIER_ROLE/);
  assert.match(routes, /\.eq\('kind', 'bulletin'\)\.in\('status', \['print_authorized', 'printed'\]\)/);
  assert.match(routes, /Cette action est réservée à la caissière/);
  assert.match(routes, /Ce bulletin n’est pas autorisé pour impression/);
});

test('official bulletins are immutable snapshots with explicit workflow states', () => {
  assert.match(migration, /snapshot jsonb not null/);
  assert.match(migration, /generated.*validated.*print_authorized.*printed/);
  assert.match(migration, /verification_code uuid/);
  assert.match(migration, /academic_document_prints/);
  assert.match(routes, /status: 'generated'/);
  assert.match(routes, /status: 'validated'/);
  assert.match(routes, /status: 'print_authorized'/);
  assert.match(routes, /status: 'printed'/);
});

test('bulletin calculations use subject coefficients and class ranking', () => {
  assert.match(routes, /subject\.coefficient/);
  assert.match(routes, /weighted20/);
  assert.match(routes, /coefficientTotal/);
  assert.match(routes, /rankIndex/);
  assert.match(routes, /classAverage/);
});

test('UI exposes document generation only to DG/DE and print launcher to cashier when work exists', () => {
  assert.match(sidebar, /currentRole === 'Directeur Général' \|\| currentRole === 'Directeur des Etudes'/);
  assert.match(sidebar, /isCashier && cashierBulletinCount > 0/);
  assert.match(sidebar, /Rapports & Bulletins/);
  assert.match(sidebar, /Bulletins à imprimer/);
  assert.match(modal, /Imprimer le bulletin/);
  assert.match(modal, /Réimpression contrôlée/);
});

test('direct Data API access to official documents is blocked', () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.academic_documents from anon, authenticated/);
  assert.match(migration, /revoke all on table public\.academic_document_prints from anon, authenticated/);
});
