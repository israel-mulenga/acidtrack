-- =====================================================================
-- AcidTrack — Pré-alerte et dossier documentaire
-- Ajoute les champs minimum pour générer le pré-alerte PDF et le bundle
-- de documents.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Commandes : numéro de facture (Invoice No.)
-- ---------------------------------------------------------------------
alter table commandes
  add column if not exists numero_facture text;

-- ---------------------------------------------------------------------
-- 2. Camions : identité du chauffeur et remorque B
-- ---------------------------------------------------------------------
alter table camions
  add column if not exists chauffeur_id_numero text;

alter table camions
  add column if not exists plaque_remorque_2 text;

-- ---------------------------------------------------------------------
-- 3. Index facilitant la recherche des documents d'un camion
-- ---------------------------------------------------------------------
create index if not exists idx_documents_camion_etape on documents(camion_id, etape_numero);
