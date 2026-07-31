/**
 * Modèles d'étapes : la séquence des sept macro-étapes est paramétrable.
 *
 * C'est ce référentiel qui pilote le formulaire terrain, les documents
 * bloquants et les SLA. Le modifier ici change le comportement de
 * l'application sans toucher au code.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Star, Workflow } from 'lucide-react'
import type { PortefeuilleComplet } from '@/hooks/useDonnees'
import { useUtilisateur } from '@/session'
import {
  creer,
  definirModeleParDefaut,
  dupliquerModele,
  modifier,
  supprimer,
} from '@/lib/crud'
import { ErreurMetier } from '@/lib/actions'
import type { ChampEtape, EtapeReferentiel, ModeleEtapes } from '@/lib/types'
import { libelleDocument } from '@/lib/workflow'
import { cn } from '@/lib/utils'
import { CrudRessource } from '@/components/CrudRessource'
import type { ValeursFormulaire } from '@/components/CrudRessource'
import { Carte, Encart } from '@/components/ui'
import { useToast } from '@/components/Toast'

const texte = (v: unknown) => String(v ?? '').trim()

function versListe(valeur: unknown): string[] {
  return String(valeur ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/** Analyse le schéma des champs métier saisi en JSON. */
function analyserChamps(valeur: unknown): { champs: ChampEtape[] } | { erreur: string } {
  const brut = texte(valeur)
  if (!brut) return { champs: [] }
  try {
    const analyse: unknown = JSON.parse(brut)
    if (!Array.isArray(analyse)) {
      return { erreur: 'Les champs métier doivent former un tableau JSON.' }
    }
    for (const champ of analyse as Record<string, unknown>[]) {
      if (!champ.cle || !champ.libelle || !champ.type) {
        return {
          erreur: 'Chaque champ métier exige au minimum « cle », « libelle » et « type ».',
        }
      }
    }
    return { champs: analyse as ChampEtape[] }
  } catch {
    return { erreur: 'Le schéma des champs métier n’est pas un JSON valide.' }
  }
}

export function SectionModeles({ portefeuille }: { portefeuille: PortefeuilleComplet }) {
  const profil = useUtilisateur()
  const toast = useToast()
  const { t } = useTranslation(['common', 'workflow'])
  const [choix, setChoix] = useState<string | null>(null)

  // Sélection courante dérivée : le choix explicite s'il reste valide,
  // sinon le modèle par défaut.
  const modeleActif =
    choix && portefeuille.modeles.some((m) => m.id === choix)
      ? choix
      : ((portefeuille.modeles.find((m) => m.par_defaut) ?? portefeuille.modeles[0])?.id ??
        null)

  const etapes = modeleActif ? (portefeuille.etapesParModele[modeleActif] ?? []) : []

  const agir = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      toast.succes(message)
      await portefeuille.recharger()
    } catch (e) {
      toast.erreur(e instanceof ErreurMetier ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      {/* Liste des modèles */}
      <CrudRessource<ModeleEtapes>
        titre={t('adminModeles.title')}
        description={t('adminModeles.description')}
        icone={<Workflow className="size-5 text-ardoise-400" />}
        libelleCreation={t('adminModeles.create')}
        elements={portefeuille.modeles}
        rechercheDans={(m) => m.nom}
        libelleElement={(m) => m.nom}
        colonnes={[
          {
            cle: 'nom',
            libelle: t('adminModeles.model'),
            rendu: (m) => (
              <button
                onClick={() => setChoix(m.id)}
                className={cn(
                  'text-left font-medium transition-colors hover:text-ambre-700',
                  modeleActif === m.id ? 'text-ambre-700' : 'text-ardoise-900',
                )}
              >
                {m.nom}
              </button>
            ),
          },
          {
            cle: 'etapes',
            libelle: t('adminModeles.steps'),
            rendu: (m) => (
              <span className="tabular-nums">
                {(portefeuille.etapesParModele[m.id] ?? []).length} / 7
              </span>
            ),
          },
          {
            cle: 'defaut',
            libelle: t('adminModeles.default'),
            rendu: (m) =>
              m.par_defaut ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Star className="size-3.5 fill-current" />
                  Oui
                </span>
              ) : (
                <span className="text-ardoise-400">—</span>
              ),
            masquerMobile: true,
          },
        ]}
        actionsSupplementaires={(m) => (
          <>
            {!m.par_defaut && (
              <button
                onClick={() =>
                  void agir(
                    () => definirModeleParDefaut(m.id, m.organisation_id),
                    t('adminModeles.modelDefaultChanged', { name: m.nom }),
                  )
                }
                title={t('adminModeles.defaultModel')}
                aria-label={t('adminModeles.defaultModel')}
                className="rounded-md p-1.5 text-ardoise-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              >
                <Star className="size-4" />
              </button>
            )}
            <button
              onClick={() =>
                void agir(
                  () => dupliquerModele(m.id, m.organisation_id, `${m.nom} (copie)`),
                  t('adminModeles.modelDuplicated'),
                )
              }
              title={t('adminModeles.duplicate')}
              aria-label={t('adminModeles.duplicate')}
              className="rounded-md p-1.5 text-ardoise-400 transition-colors hover:bg-ardoise-100 hover:text-ardoise-900"
            >
              <Copy className="size-4" />
            </button>
          </>
        )}
        champs={() => [
          { cle: 'nom', libelle: t('adminModeles.name'), type: 'texte', obligatoire: true },
          { cle: 'description', libelle: t('adminModeles.descriptionLabel'), type: 'zone' },
          { cle: 'actif', libelle: t('adminModeles.active'), type: 'booleen' },
        ]}
        valeursInitiales={(m) => ({
          nom: m?.nom ?? '',
          description: m?.description ?? '',
          actif: m?.actif ?? true,
        })}
        onEnregistrer={async (v, element) => {
          const ligne = {
            organisation_id: profil.organisation_id,
            nom: texte(v.nom),
            description: texte(v.description) || null,
            actif: v.actif === true,
          }
          if (element) await modifier('modeles_etapes', element.id, ligne)
          else await creer('modeles_etapes', ligne)
          toast.succes(element ? t('adminModeles.modelUpdated') : t('adminModeles.modelCreated'))
          await portefeuille.recharger()
        }}
        onSupprimer={async (m) => {
          if (m.par_defaut) {
            throw new ErreurMetier(
              t('adminModeles.defaultModelCannotDelete'),
            )
          }
          await supprimer('modeles_etapes', m.id)
          toast.succes(t('adminModeles.modelDeleted'))
          await portefeuille.recharger()
        }}
      />

      {/* Étapes du modèle sélectionné */}
      {modeleActif && (
        <Carte className="p-4 sm:p-5">
          {etapes.length < 7 && (
            <Encart ton="alerte" className="mb-4">
              {t('adminModeles.stepCountWarning', {
                count: etapes.length,
                plural: etapes.length > 1 ? 's' : '',
              })}
            </Encart>
          )}

          <CrudRessource<EtapeReferentiel>
            titre={t('adminModeles.stepsTitle', { name: portefeuille.modeles.find((m) => m.id === modeleActif)?.nom ?? '' })}
            description={t('adminModeles.stepsDescription')}
            libelleCreation={t('adminModeles.createStep')}
            elements={etapes}
            rechercheDans={(e) => `${e.numero} ${e.libelle} ${e.code}`}
            libelleElement={(e) => `Étape ${e.numero} — ${e.libelle}`}
            colonnes={[
              {
                cle: 'numero',
                libelle: '#',
                rendu: (e) => (
                  <span className="font-semibold tabular-nums text-ardoise-900">{e.numero}</span>
                ),
              },
              {
                cle: 'libelle',
                libelle: t('adminModeles.step'),
                rendu: (e) => (
                  <span className="font-medium text-ardoise-900">{e.libelle}</span>
                ),
              },
              {
                cle: 'responsable',
                libelle: t('adminModeles.responsible'),
                rendu: (e) => e.responsable || '—',
                masquerMobile: true,
              },
              {
                cle: 'sla',
                libelle: 'SLA',
                rendu: (e) => <span className="tabular-nums">{e.sla_heures} h</span>,
              },
              {
                cle: 'documents',
                libelle: t('adminModeles.blockingDocuments'),
                rendu: (e) =>
                  e.documents_requis.length === 0 ? (
                    <span className="text-ardoise-400">{t('adminModeles.none')}</span>
                  ) : (
                    <span className="text-xs text-ardoise-500">
                      {e.documents_requis.map(libelleDocument).join(', ')}
                    </span>
                  ),
                masquerMobile: true,
              },
              {
                cle: 'champs',
                libelle: t('adminModeles.fields'),
                rendu: (e) => <span className="tabular-nums">{e.champs.length}</span>,
                masquerMobile: true,
              },
            ]}
            champs={() => [
              { cle: 'numero', libelle: t('adminModeles.number'), type: 'nombre', obligatoire: true },
              { cle: 'code', libelle: t('adminModeles.code'), type: 'texte', obligatoire: true },
              { cle: 'libelle', libelle: t('adminModeles.label'), type: 'texte', obligatoire: true },
              { cle: 'responsable', libelle: t('adminModeles.responsible'), type: 'texte' },
              { cle: 'sla_heures', libelle: t('adminModeles.sla'), type: 'nombre', unite: 'h', obligatoire: true },
              { cle: 'objectif', libelle: t('adminModeles.objective'), type: 'zone' },
              {
                cle: 'documents_requis',
                libelle: t('adminModeles.requiredDocuments'),
                type: 'texte',
                pleineLargeur: true,
                aide: t('adminModeles.requiredDocumentsExplanation'),
              },
              {
                cle: 'champs',
                libelle: t('adminModeles.businessFields'),
                type: 'zone',
                aide: t('adminModeles.businessFieldsExplanation'),
                  
              },
            ]}
            valeursInitiales={(e) => ({
              numero: e?.numero?.toString() ?? String(etapes.length + 1),
              code: e?.code ?? '',
              libelle: e?.libelle ?? '',
              responsable: e?.responsable ?? '',
              sla_heures: e?.sla_heures?.toString() ?? '24',
              objectif: e?.objectif ?? '',
              documents_requis: e?.documents_requis.join(', ') ?? '',
              champs: JSON.stringify(e?.champs ?? [], null, 2),
            })}
            valider={(v: ValeursFormulaire, element) => {
              const erreurs: string[] = []
              const numero = Number(v.numero)
              if (!Number.isInteger(numero) || numero < 1 || numero > 7) {
                erreurs.push(t('adminModeles.stepNumberError'))
              } else if (etapes.some((e) => e.numero === numero && e.id !== element?.id)) {
                erreurs.push(t('adminModeles.stepAlreadyDefined', { number: numero }))
              }
              if (Number(v.sla_heures) <= 0) {
                erreurs.push(t('adminModeles.slaRequired'))
              }
              const analyse = analyserChamps(v.champs)
              if ('erreur' in analyse) erreurs.push(analyse.erreur)
              return erreurs
            }}
            onEnregistrer={async (v, element) => {
              const analyse = analyserChamps(v.champs)
              if ('erreur' in analyse) throw new ErreurMetier(analyse.erreur)

              const ligne = {
                modele_id: modeleActif,
                numero: Number(v.numero),
                code: texte(v.code),
                libelle: texte(v.libelle),
                responsable: texte(v.responsable),
                sla_heures: Number(v.sla_heures),
                objectif: texte(v.objectif),
                documents_requis: versListe(v.documents_requis).map((d) => d.toUpperCase()),
                champs: analyse.champs,
              }
              if (element) await modifier('modeles_etapes_lignes', element.id, ligne)
              else await creer('modeles_etapes_lignes', ligne)
              toast.succes(element ? t('adminModeles.stepUpdated') : t('adminModeles.stepCreated'))
              await portefeuille.recharger()
            }}
            onSupprimer={async (e) => {
              await supprimer('modeles_etapes_lignes', e.id)
              toast.succes(t('adminModeles.stepDeleted'))
              await portefeuille.recharger()
            }}
          />
        </Carte>
      )}
    </div>
  )
}
