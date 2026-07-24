-- =====================================================================
-- AcidTrack — Jeu de données de démonstration
-- À exécuter APRÈS 01_schema.sql
-- Scénario : 1 commande, 2 lots, 5 camions positionnés sur 5 étapes
--            différentes (critère de recette AC-01 / AC-02)
-- =====================================================================

truncate incidents, documents, etape_evenements, paiements,
         camions, lots, commandes, clients, utilisateurs,
         organisations, etapes_referentiel restart identity cascade;

-- ---------------------------------------------------------------------
-- 1. Référentiel des 7 macro-étapes
--    documents_requis = bloquants pour passer une étape en TERMINE
-- ---------------------------------------------------------------------
insert into etapes_referentiel (numero, code, libelle, objectif, responsable, sla_heures, documents_requis, champs) values
(1, 'CHARGEMENT', 'Chargement et préparation du produit',
 'Identifier le camion, confirmer la quantité réellement chargée et constituer le dossier de départ.',
 'Agent de chargement / Opérations', 12,
 array['BL','TICKET_PESEE','COA'],
 '[
   {"cle":"lieu_chargement","libelle":"Lieu de chargement","type":"text","obligatoire":true},
   {"cle":"poids_brut","libelle":"Poids brut","type":"number","unite":"t","obligatoire":true},
   {"cle":"tare","libelle":"Tare","type":"number","unite":"t","obligatoire":true},
   {"cle":"poids_net","libelle":"Poids net chargé","type":"number","unite":"t","obligatoire":true},
   {"cle":"concentration","libelle":"Concentration","type":"text","obligatoire":true},
   {"cle":"numeros_scelles","libelle":"Numéros de scellés","type":"text","obligatoire":true}
 ]'::jsonb),

(2, 'PAIEMENT_INITIAL', 'Paiement initial validé',
 'Confirmer que la condition financière autorisant le départ est satisfaite.',
 'Finance', 24,
 array['AVIS_BANCAIRE'],
 '[
   {"cle":"montant","libelle":"Montant reçu","type":"number","unite":"USD","obligatoire":true},
   {"cle":"devise","libelle":"Devise","type":"select","options":["USD","ZMW","CDF"],"obligatoire":true},
   {"cle":"mode","libelle":"Mode de paiement","type":"select","options":["Virement","Chèque","Espèces"],"obligatoire":true},
   {"cle":"reference_bancaire","libelle":"Référence bancaire","type":"text","obligatoire":true},
   {"cle":"date_valeur","libelle":"Date de valeur","type":"date","obligatoire":true}
 ]'::jsonb),

(3, 'SORTIE_ZAMBIE', 'Déclaration et sortie Zambie',
 'Tracer l''acceptation des documents d''exportation puis la sortie du territoire zambien.',
 'Transitaire / Douane Zambie', 48,
 array['DECLARATION_EXPORT','CMR'],
 '[
   {"cle":"poste_frontiere","libelle":"Poste frontière","type":"select","options":["Kasumbalesa","Sakania","Mokambo"],"obligatoire":true},
   {"cle":"numero_declaration","libelle":"N° de déclaration export","type":"text","obligatoire":true},
   {"cle":"declarant","libelle":"Déclarant","type":"text","obligatoire":true},
   {"cle":"date_acceptation","libelle":"Date d''acceptation","type":"datetime","obligatoire":true},
   {"cle":"heure_sortie","libelle":"Heure de sortie Zambie","type":"datetime","obligatoire":true}
 ]'::jsonb),

(4, 'ENTREE_RDC', 'Déclaration et entrée RDC',
 'Tracer l''importation, les droits applicables et la libération du camion côté RDC.',
 'Transitaire / Douane RDC', 72,
 array['DECLARATION_IMPORT','QUITTANCE'],
 '[
   {"cle":"bureau_douanier","libelle":"Bureau douanier","type":"text","obligatoire":true},
   {"cle":"numero_declaration","libelle":"N° de déclaration import","type":"text","obligatoire":true},
   {"cle":"importateur","libelle":"Importateur","type":"text","obligatoire":true},
   {"cle":"date_entree","libelle":"Date d''entrée RDC","type":"datetime","obligatoire":true},
   {"cle":"date_mainlevee","libelle":"Date de mainlevée","type":"datetime","obligatoire":true}
 ]'::jsonb),

(5, 'TRANSIT_RDC', 'Transit intérieur et points de contrôle',
 'Suivre le camion après la frontière jusqu''à la zone de livraison.',
 'Escorteur / Chauffeur / Contrôle opérations', 24,
 array['RECU_PEAGE'],
 '[
   {"cle":"point_atteint","libelle":"Point de contrôle atteint","type":"select","options":["Kasumbalesa","Péage Lubumbashi","Likasi","Péage Kolwezi","Fungurume"],"obligatoire":true},
   {"cle":"kilometrage","libelle":"Kilométrage","type":"number","unite":"km","obligatoire":false},
   {"cle":"eta_revisee","libelle":"ETA révisée","type":"datetime","obligatoire":true},
   {"cle":"motif_arret","libelle":"Motif d''arrêt éventuel","type":"textarea","obligatoire":false}
 ]'::jsonb),

(6, 'ARRIVEE_MINE', 'Arrivée à la mine et déchargement',
 'Confirmer la réception physique, la quantité acceptée et la preuve de livraison.',
 'Réception mine / Opérations', 12,
 array['POD','TICKET_PESEE_MINE'],
 '[
   {"cle":"heure_entree_mine","libelle":"Heure d''entrée mine","type":"datetime","obligatoire":true},
   {"cle":"poids_arrivee","libelle":"Poids à l''arrivée","type":"number","unite":"t","obligatoire":true},
   {"cle":"quantite_acceptee","libelle":"Quantité acceptée","type":"number","unite":"t","obligatoire":true},
   {"cle":"resultat_qualite","libelle":"Résultat qualité","type":"select","options":["Conforme","Accepté sous réserve","Non conforme"],"obligatoire":true},
   {"cle":"receptionnaire","libelle":"Nom du réceptionnaire","type":"text","obligatoire":true}
 ]'::jsonb),

(7, 'RETOUR_CLOTURE', 'Retour du camion et règlement final',
 'Confirmer la sortie à vide et la clôture financière et documentaire du dossier.',
 'Opérations et Finance', 72,
 array['FACTURE_FINALE','PREUVE_SOLDE'],
 '[
   {"cle":"heure_sortie_mine","libelle":"Heure de sortie mine","type":"datetime","obligatoire":true},
   {"cle":"montant_final","libelle":"Montant final facturé","type":"number","unite":"USD","obligatoire":true},
   {"cle":"solde_paye","libelle":"Solde payé","type":"number","unite":"USD","obligatoire":true},
   {"cle":"motif_cloture","libelle":"Observation de clôture","type":"textarea","obligatoire":false}
 ]'::jsonb);

-- ---------------------------------------------------------------------
-- 2. Organisation, utilisateurs, clients
-- ---------------------------------------------------------------------
insert into organisations (id, nom, plan, fuseau) values
('11111111-1111-1111-1111-111111111111', 'Sulfachem Logistics', 'PILOTE', 'Africa/Lubumbashi');

insert into clients (id, organisation_id, raison_sociale, mine, ville, contact_nom, contact_tel) values
('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111',
 'Kamoto Copper Company', 'Mine KCC', 'Kolwezi', 'Patrick Mwamba', '+243 991 000 111'),
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
 'Ruashi Mining', 'Mine Ruashi', 'Lubumbashi', 'Sarah Ilunga', '+243 991 000 222');

insert into utilisateurs (id, organisation_id, nom, role, email, telephone, client_id) values
('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111',
 'Joseph Kabeya', 'OPS', 'ops@sulfachem.cd', '+243 970 111 001', null),
('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111111',
 'Alain Tshibangu', 'TERRAIN', 'terrain@sulfachem.cd', '+243 970 111 002', null),
('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111111',
 'Patrick Mwamba', 'CLIENT', 'patrick@kcc.cd', '+243 991 000 111',
 '22222222-2222-2222-2222-222222222221'),
('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111111',
 'Nadine Kalonji', 'FINANCE', 'finance@sulfachem.cd', '+243 970 111 004', null);

-- ---------------------------------------------------------------------
-- 3. Commande et lots
-- ---------------------------------------------------------------------
insert into commandes (id, organisation_id, client_id, reference, quantite_commandee_t,
                       prix_unitaire_usd, destination, conditions_paiement) values
('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111',
 '22222222-2222-2222-2222-222222222221', 'PO-2026-0060', 1500.00, 285.00,
 'Kolwezi / Lubumbashi', '30% à la commande, solde à 15 jours après livraison');

insert into lots (id, organisation_id, commande_id, reference, corridor, destination,
                  quantite_planifiee_t, nb_camions_prevu, periode_debut, periode_fin) values
('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111',
 '33333333-3333-3333-3333-333333333331', 'LOT-0060-01',
 'Zambie → Kolwezi', 'Kolwezi', 95.00, 3, current_date - 6, current_date + 3),
('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111',
 '33333333-3333-3333-3333-333333333331', 'LOT-0060-02',
 'Zambie → Lubumbashi', 'Lubumbashi', 62.00, 2, current_date - 3, current_date + 5);

-- ---------------------------------------------------------------------
-- 4. Cinq dossiers camions sur cinq étapes différentes (AC-02)
-- ---------------------------------------------------------------------
insert into camions (id, organisation_id, lot_id, reference, plaque_tracteur, plaque_citerne,
                     transporteur, chauffeur_nom, chauffeur_tel, capacite_t, tonnage_net_t,
                     numeros_scelles, etape_courante, statut, eta,
                     derniere_position_lat, derniere_position_lng, derniere_position_lib,
                     derniere_maj_at, derniere_maj_par) values

-- Presque livré : arrivée mine en cours
('55555555-5555-5555-5555-555555555001', '11111111-1111-1111-1111-111111111111',
 '44444444-4444-4444-4444-444444444441', 'TRK-0060-01-01', 'ABT 4521 ZM', 'CIT 8890 ZM',
 'Trans-Copperbelt Ltd', 'Moses Banda', '+260 977 220 145', 34.00, 32.50,
 'SC-88412 / SC-88413', 6, 'EN_COURS', now() + interval '3 hours',
 -10.7167, 25.4667, 'Mine KCC, Kolwezi', now() - interval '2 hours', 'Alain Tshibangu'),

-- En attente de validation Ops sur la déclaration RDC (démo AC-04 : rejet)
('55555555-5555-5555-5555-555555555002', '11111111-1111-1111-1111-111111111111',
 '44444444-4444-4444-4444-444444444441', 'TRK-0060-01-02', 'ABT 7734 ZM', 'CIT 9012 ZM',
 'Trans-Copperbelt Ltd', 'Chanda Mulenga', '+260 977 220 178', 32.00, 30.00,
 'SC-88420 / SC-88421', 4, 'EN_COURS', now() + interval '2 days',
 -12.2167, 27.7833, 'Frontière de Kasumbalesa (côté RDC)', now() - interval '5 hours', 'Alain Tshibangu'),

-- Bloqué à la frontière (incident critique)
('55555555-5555-5555-5555-555555555003', '11111111-1111-1111-1111-111111111111',
 '44444444-4444-4444-4444-444444444441', 'TRK-0060-01-03', 'ABT 1190 ZM', 'CIT 4456 ZM',
 'Zamlink Transport', 'Emmanuel Phiri', '+260 966 331 902', 32.00, 30.00,
 'SC-88430 / SC-88431', 3, 'BLOQUE', now() + interval '4 days',
 -12.2500, 27.7900, 'Poste frontière de Kasumbalesa (côté Zambie)',
 now() - interval '19 hours', 'Alain Tshibangu'),

-- En transit RDC, SLA dépassé (démo AC-05 : en retard)
('55555555-5555-5555-5555-555555555004', '11111111-1111-1111-1111-111111111111',
 '44444444-4444-4444-4444-444444444442', 'TRK-0060-02-01', 'ABT 6650 ZM', 'CIT 3321 ZM',
 'Zamlink Transport', 'Jean-Pierre Kasongo', '+243 810 445 221', 34.00, 33.00,
 'SC-88440 / SC-88441', 5, 'EN_COURS', now() + interval '6 hours',
 -11.6876, 27.5026, 'Péage de Lubumbashi', now() - interval '31 hours', 'Jean-Pierre Kasongo'),

-- Tout début : chargement en Zambie
('55555555-5555-5555-5555-555555555005', '11111111-1111-1111-1111-111111111111',
 '44444444-4444-4444-4444-444444444442', 'TRK-0060-02-02', 'ABT 2287 ZM', 'CIT 7765 ZM',
 'Trans-Copperbelt Ltd', 'Gift Simwanza', '+260 955 118 640', 30.00, 29.00,
 'SC-88450 / SC-88451', 1, 'EN_COURS', now() + interval '5 days',
 -12.8100, 28.2100, 'Usine de Ndola, Zambie', now() - interval '45 minutes', 'Alain Tshibangu');

-- ---------------------------------------------------------------------
-- 5. Historique des événements (table append-only)
-- ---------------------------------------------------------------------
insert into etape_evenements (organisation_id, camion_id, etape_numero, statut, commentaire,
                              donnees, position_lat, position_lng, position_lib, position_source,
                              auteur_nom, auteur_role, valide_par, valide_at, created_at) values

-- === TRK-0060-01-01 : étapes 1 à 5 terminées, étape 6 en cours ===
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',1,'TERMINE',
 'Chargement effectué sans incident, scellés posés en présence du chauffeur.',
 '{"lieu_chargement":"Usine de Ndola","poids_brut":"48.20","tare":"15.70","poids_net":"32.50","concentration":"98%","numeros_scelles":"SC-88412 / SC-88413"}',
 -12.9587,28.6366,'Usine de Ndola, Zambie','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '6 days', now() - interval '6 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',2,'TERMINE',
 'Avance de 30% reçue, départ autorisé.',
 '{"montant":"9262.50","devise":"USD","mode":"Virement","reference_bancaire":"TRF-2026-4471","date_valeur":"2026-07-19"}',
 null,null,null,null,'Nadine Kalonji','FINANCE','Joseph Kabeya', now() - interval '6 days', now() - interval '6 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',3,'TERMINE',
 'Déclaration export acceptée, sortie du territoire zambien confirmée.',
 '{"poste_frontiere":"Kasumbalesa","numero_declaration":"ZM-EX-2026-11842","declarant":"Copperfield Clearing","date_acceptation":"2026-07-19T08:20","heure_sortie":"2026-07-19T14:05"}',
 -12.2500,27.7900,'Poste frontière de Kasumbalesa','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '5 days', now() - interval '5 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',4,'TERMINE',
 'Mainlevée obtenue, camion libéré côté RDC.',
 '{"bureau_douanier":"DGDA Kasumbalesa","numero_declaration":"CD-IM-2026-09931","importateur":"Kamoto Copper Company","date_entree":"2026-07-20T09:10","date_mainlevee":"2026-07-20T16:40"}',
 -12.2167,27.7833,'Kasumbalesa, RDC','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '4 days', now() - interval '4 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',5,'TERMINE',
 'Passage du péage de Kolwezi, aucun arrêt anormal.',
 '{"point_atteint":"Péage Kolwezi","kilometrage":"612","eta_revisee":"2026-07-24T09:00"}',
 -10.7167,25.4667,'Péage de Kolwezi','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '1 day', now() - interval '1 day'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',6,'EN_COURS',
 'Camion entré sur le site, en file d''attente pour la bascule.',
 '{"heure_entree_mine":"2026-07-24T21:30"}',
 -10.7167,25.4667,'Mine KCC, Kolwezi','GPS','Alain Tshibangu','TERRAIN',
 null,null, now() - interval '2 hours'),

-- === TRK-0060-01-02 : étapes 1 à 3 terminées, étape 4 en attente de validation ===
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',1,'TERMINE',
 'Chargement conforme.',
 '{"lieu_chargement":"Usine de Ndola","poids_brut":"45.80","tare":"15.80","poids_net":"30.00","concentration":"98%","numeros_scelles":"SC-88420 / SC-88421"}',
 -12.9587,28.6366,'Usine de Ndola, Zambie','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '5 days', now() - interval '5 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',2,'TERMINE',
 'Paiement initial confirmé par la banque.',
 '{"montant":"8550.00","devise":"USD","mode":"Virement","reference_bancaire":"TRF-2026-4478","date_valeur":"2026-07-20"}',
 null,null,null,null,'Nadine Kalonji','FINANCE','Joseph Kabeya', now() - interval '5 days', now() - interval '5 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',3,'TERMINE',
 'Sortie Zambie effectuée après 6 h d''attente au poste.',
 '{"poste_frontiere":"Kasumbalesa","numero_declaration":"ZM-EX-2026-11866","declarant":"Copperfield Clearing","date_acceptation":"2026-07-22T11:00","heure_sortie":"2026-07-22T17:45"}',
 -12.2500,27.7900,'Poste frontière de Kasumbalesa','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '2 days', now() - interval '2 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',4,'EN_ATTENTE_VALIDATION',
 'Déclaration import déposée, quittance jointe. En attente de contrôle opérations.',
 '{"bureau_douanier":"DGDA Kasumbalesa","numero_declaration":"CD-IM-2026-09977","importateur":"Kamoto Copper Company","date_entree":"2026-07-24T14:20","date_mainlevee":"2026-07-24T18:00"}',
 -12.2167,27.7833,'Frontière de Kasumbalesa (côté RDC)','GPS','Alain Tshibangu','TERRAIN',
 null,null, now() - interval '5 hours'),

-- === TRK-0060-01-03 : étapes 1-2 terminées, bloqué à l'étape 3 ===
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',1,'TERMINE',
 'Chargement conforme, citerne inspectée.',
 '{"lieu_chargement":"Usine de Ndola","poids_brut":"45.90","tare":"15.90","poids_net":"30.00","concentration":"98%","numeros_scelles":"SC-88430 / SC-88431"}',
 -12.9587,28.6366,'Usine de Ndola, Zambie','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '4 days', now() - interval '4 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',2,'TERMINE',
 'Avance reçue.',
 '{"montant":"8550.00","devise":"USD","mode":"Virement","reference_bancaire":"TRF-2026-4482","date_valeur":"2026-07-21"}',
 null,null,null,null,'Nadine Kalonji','FINANCE','Joseph Kabeya', now() - interval '4 days', now() - interval '4 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',3,'BLOQUE',
 'Blocage douane : divergence entre le poids déclaré et le ticket de pesée. Dossier suspendu.',
 '{"poste_frontiere":"Kasumbalesa","numero_declaration":"ZM-EX-2026-11901","declarant":"Copperfield Clearing"}',
 -12.2500,27.7900,'Poste frontière de Kasumbalesa (côté Zambie)','GPS','Alain Tshibangu','TERRAIN',
 null,null, now() - interval '19 hours'),

-- === TRK-0060-02-01 : étapes 1-4 terminées, étape 5 en cours et en retard ===
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',1,'TERMINE',
 'Chargement conforme.',
 '{"lieu_chargement":"Usine de Ndola","poids_brut":"48.70","tare":"15.70","poids_net":"33.00","concentration":"98%","numeros_scelles":"SC-88440 / SC-88441"}',
 -12.9587,28.6366,'Usine de Ndola, Zambie','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '3 days', now() - interval '3 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',2,'TERMINE',
 'Paiement initial validé.',
 '{"montant":"9405.00","devise":"USD","mode":"Virement","reference_bancaire":"TRF-2026-4490","date_valeur":"2026-07-22"}',
 null,null,null,null,'Nadine Kalonji','FINANCE','Joseph Kabeya', now() - interval '3 days', now() - interval '3 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',3,'TERMINE',
 'Sortie Zambie sans incident.',
 '{"poste_frontiere":"Kasumbalesa","numero_declaration":"ZM-EX-2026-11912","declarant":"Copperfield Clearing","date_acceptation":"2026-07-22T07:30","heure_sortie":"2026-07-22T12:15"}',
 -12.2500,27.7900,'Poste frontière de Kasumbalesa','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '2 days', now() - interval '2 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',4,'TERMINE',
 'Mainlevée RDC obtenue rapidement.',
 '{"bureau_douanier":"DGDA Kasumbalesa","numero_declaration":"CD-IM-2026-09950","importateur":"Ruashi Mining","date_entree":"2026-07-23T08:00","date_mainlevee":"2026-07-23T13:20"}',
 -12.2167,27.7833,'Kasumbalesa, RDC','GPS','Alain Tshibangu','TERRAIN',
 'Joseph Kabeya', now() - interval '2 days', now() - interval '2 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',5,'EN_COURS',
 'Arrêt prolongé au péage de Lubumbashi, file d''attente importante.',
 '{"point_atteint":"Péage Lubumbashi","kilometrage":"98","eta_revisee":"2026-07-25T06:00","motif_arret":"File d''attente au péage"}',
 -11.6876,27.5026,'Péage de Lubumbashi','GPS','Jean-Pierre Kasongo','TERRAIN',
 null,null, now() - interval '31 hours'),

-- === TRK-0060-02-02 : chargement en cours ===
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555005',1,'EN_COURS',
 'Camion positionné sous le poste de chargement, pesée à vide effectuée.',
 '{"lieu_chargement":"Usine de Ndola","tare":"15.60"}',
 -12.8100,28.2100,'Usine de Ndola, Zambie','GPS','Alain Tshibangu','TERRAIN',
 null,null, now() - interval '45 minutes');

-- ---------------------------------------------------------------------
-- 6. Documents déposés (preuves)
-- ---------------------------------------------------------------------
insert into documents (organisation_id, camion_id, etape_numero, type, nom_fichier,
                       mime, taille_octets, visible_client, depose_par, created_at) values
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',1,'BL','BL-TRK-0060-01-01.pdf','application/pdf',248311,true,'Alain Tshibangu', now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',1,'TICKET_PESEE','Pesee-Ndola-88412.pdf','application/pdf',96420,true,'Alain Tshibangu', now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',1,'COA','CoA-H2SO4-98-88412.pdf','application/pdf',132004,true,'Alain Tshibangu', now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',2,'AVIS_BANCAIRE','Avis-debit-TRF-4471.pdf','application/pdf',75210,false,'Nadine Kalonji', now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',3,'DECLARATION_EXPORT','ZM-EX-2026-11842.pdf','application/pdf',311982,true,'Alain Tshibangu', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',3,'CMR','CMR-11842.pdf','application/pdf',158772,true,'Alain Tshibangu', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',4,'DECLARATION_IMPORT','CD-IM-2026-09931.pdf','application/pdf',288140,true,'Alain Tshibangu', now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',4,'QUITTANCE','Quittance-DGDA-09931.pdf','application/pdf',64318,false,'Alain Tshibangu', now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555001',5,'RECU_PEAGE','Recu-peage-kolwezi.jpg','image/jpeg',412990,true,'Alain Tshibangu', now() - interval '1 day'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',1,'BL','BL-TRK-0060-01-02.pdf','application/pdf',241118,true,'Alain Tshibangu', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',1,'TICKET_PESEE','Pesee-Ndola-88420.pdf','application/pdf',94002,true,'Alain Tshibangu', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',1,'COA','CoA-H2SO4-98-88420.pdf','application/pdf',130551,true,'Alain Tshibangu', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',2,'AVIS_BANCAIRE','Avis-debit-TRF-4478.pdf','application/pdf',72330,false,'Nadine Kalonji', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',3,'DECLARATION_EXPORT','ZM-EX-2026-11866.pdf','application/pdf',305221,true,'Alain Tshibangu', now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',3,'CMR','CMR-11866.pdf','application/pdf',151009,true,'Alain Tshibangu', now() - interval '2 days'),
-- Étape 4 en attente : la quittance manque volontairement (démo AC-03)
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555002',4,'DECLARATION_IMPORT','CD-IM-2026-09977.pdf','application/pdf',279440,true,'Alain Tshibangu', now() - interval '5 hours'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',1,'BL','BL-TRK-0060-01-03.pdf','application/pdf',239887,true,'Alain Tshibangu', now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',1,'TICKET_PESEE','Pesee-Ndola-88430.pdf','application/pdf',93110,true,'Alain Tshibangu', now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',1,'COA','CoA-H2SO4-98-88430.pdf','application/pdf',129004,true,'Alain Tshibangu', now() - interval '4 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',2,'AVIS_BANCAIRE','Avis-debit-TRF-4482.pdf','application/pdf',71002,false,'Nadine Kalonji', now() - interval '4 days'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',1,'BL','BL-TRK-0060-02-01.pdf','application/pdf',244771,true,'Alain Tshibangu', now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',1,'TICKET_PESEE','Pesee-Ndola-88440.pdf','application/pdf',95330,true,'Alain Tshibangu', now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',1,'COA','CoA-H2SO4-98-88440.pdf','application/pdf',131220,true,'Alain Tshibangu', now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',2,'AVIS_BANCAIRE','Avis-debit-TRF-4490.pdf','application/pdf',73998,false,'Nadine Kalonji', now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',3,'DECLARATION_EXPORT','ZM-EX-2026-11912.pdf','application/pdf',300118,true,'Alain Tshibangu', now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',3,'CMR','CMR-11912.pdf','application/pdf',149887,true,'Alain Tshibangu', now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',4,'DECLARATION_IMPORT','CD-IM-2026-09950.pdf','application/pdf',281009,true,'Alain Tshibangu', now() - interval '2 days'),
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',4,'QUITTANCE','Quittance-DGDA-09950.pdf','application/pdf',63114,false,'Alain Tshibangu', now() - interval '2 days');

-- ---------------------------------------------------------------------
-- 7. Incident critique -> le trigger passe TRK-0060-01-03 en BLOQUE
-- ---------------------------------------------------------------------
insert into incidents (organisation_id, camion_id, etape_numero, categorie, gravite,
                       description, responsable, plan_action, statut, ouvert_par, created_at) values
('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555003',3,
 'DOUANE','CRITIQUE',
 'La douane zambienne relève un écart de 0,4 t entre le poids déclaré et le ticket de pesée. Le camion est immobilisé au poste de Kasumbalesa.',
 'Copperfield Clearing',
 'Re-pesée contradictoire demandée pour ce matin, puis dépôt d''une déclaration rectificative.',
 'OUVERT','Joseph Kabeya', now() - interval '19 hours'),

('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555004',5,
 'RETARD','MOYENNE',
 'Attente supérieure à 24 h au péage de Lubumbashi, ETA repoussée.',
 'Jean-Pierre Kasongo',
 'Suivi horaire par le contrôleur opérations, information du client envoyée.',
 'OUVERT','Joseph Kabeya', now() - interval '7 hours');

-- ---------------------------------------------------------------------
-- 8. Paiements (deux versements partiels — esprit AC-07)
-- ---------------------------------------------------------------------
insert into paiements (organisation_id, commande_id, type, montant, devise, reference,
                       date_valeur, statut) values
('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333331','INITIAL',
 90000.00,'USD','TRF-2026-4471', current_date - 6,'RECU'),
('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333331','INITIAL',
 38250.00,'USD','TRF-2026-4490', current_date - 3,'RECU'),
('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333331','FINAL',
 299250.00,'USD',null, null,'ATTENDU');

-- ---------------------------------------------------------------------
-- Contrôle rapide
-- ---------------------------------------------------------------------
select 'camions' as table_, count(*) from camions
union all select 'evenements', count(*) from etape_evenements
union all select 'documents', count(*) from documents
union all select 'incidents', count(*) from incidents;
