/**
 * Chronologie verticale des 7 macro-étapes — cœur visuel du produit.
 *
 * Chaque étape affiche son état, ses données saisies, ses preuves, son auteur
 * et son horodatage. L'étape courante est la seule actionnable (§12.2).
 */

import { Fragment } from 'react'
import {
  Ban,
  Check,
  CircleDashed,
  Clock,
  FileText,
  Hourglass,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import type {
  Camion,
  Document,
  EtapeEvenement,
  EtapeReferentiel,
  StatutEtape,
} from '@/lib/types'
import {
  dernierEvenementEtape,
  etapeActionnable,
  libelleDocument,
  statutEtape,
} from '@/lib/workflow'
import { cn, formatDateHeure, formatTaille } from '@/lib/utils'
import { BadgeEtape, Bouton, Encart } from './ui'

/* ------------------------------------------------------------------ */
/* Pastille d'état                                                     */
/* ------------------------------------------------------------------ */

const PASTILLE: Record<StatutEtape, { classe: string; icone: React.ReactNode }> = {
  TERMINE: {
    classe: 'bg-emerald-500 text-white ring-emerald-100',
    icone: <Check className="size-4" strokeWidth={3} />,
  },
  EN_COURS: {
    classe: 'bg-blue-500 text-white ring-blue-100',
    icone: <Clock className="size-4" strokeWidth={2.5} />,
  },
  EN_ATTENTE_VALIDATION: {
    classe: 'bg-violet-500 text-white ring-violet-100',
    icone: <Hourglass className="size-4" strokeWidth={2.5} />,
  },
  EN_ATTENTE_ACTION: {
    classe: 'bg-ambre-500 text-ardoise-950 ring-ambre-100 animate-pulse-ring',
    icone: <CircleDashed className="size-4" strokeWidth={2.5} />,
  },
  EN_RETARD: {
    classe: 'bg-orange-500 text-white ring-orange-100',
    icone: <TriangleAlert className="size-4" strokeWidth={2.5} />,
  },
  BLOQUE: {
    classe: 'bg-red-600 text-white ring-red-100',
    icone: <TriangleAlert className="size-4" strokeWidth={2.5} />,
  },
  PLANIFIE: {
    classe: 'bg-white text-ardoise-300 ring-ardoise-100 border border-ardoise-200',
    icone: <CircleDashed className="size-4" />,
  },
  ANNULE: {
    classe: 'bg-ardoise-300 text-white ring-ardoise-100',
    icone: <Ban className="size-4" />,
  },
}

/* ------------------------------------------------------------------ */
/* Preuve attachée                                                     */
/* ------------------------------------------------------------------ */

function Preuve({ document }: { document: Document }) {
  const estImage = document.mime?.startsWith('image/')
  const contenu = (
    <>
      {estImage ? (
        <ImageIcon className="size-3.5 shrink-0 text-ardoise-400" />
      ) : (
        <FileText className="size-3.5 shrink-0 text-ardoise-400" />
      )}
      <span className="min-w-0 truncate">{libelleDocument(document.type)}</span>
      {document.taille_octets && (
        <span className="shrink-0 text-ardoise-400">{formatTaille(document.taille_octets)}</span>
      )}
    </>
  )

  const classe =
    'inline-flex max-w-full items-center gap-1.5 rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-700'

  return document.url ? (
    <a
      href={document.url}
      target="_blank"
      rel="noreferrer"
      className={cn(classe, 'transition-colors hover:border-ardoise-300 hover:bg-ardoise-50')}
      onClick={(e) => e.stopPropagation()}
    >
      {contenu}
    </a>
  ) : (
    <span className={classe} title="Document de démonstration, aperçu indisponible">
      {contenu}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Une étape                                                           */
/* ------------------------------------------------------------------ */

function Etape({
  etape,
  statut,
  evenement,
  documents,
  derniere,
  actionnable,
  vueClient,
  onMettreAJour,
  onValider,
  onRejeter,
  peutValider,
}: {
  etape: EtapeReferentiel
  statut: StatutEtape
  evenement?: EtapeEvenement
  documents: Document[]
  derniere: boolean
  actionnable: boolean
  vueClient: boolean
  onMettreAJour?: () => void
  onValider?: (e: EtapeEvenement) => void
  onRejeter?: (e: EtapeEvenement) => void
  peutValider: boolean
}) {
  const pastille = PASTILLE[statut]
  const active = statut !== 'PLANIFIE'
  const champsRenseignes = etape.champs.filter((c) => evenement?.donnees?.[c.cle])

  return (
    <div className="relative flex gap-3.5 pb-1">
      {/* Rail vertical */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full ring-4 transition-colors',
            pastille.classe,
          )}
        >
          {pastille.icone}
        </span>
        {!derniere && (
          <span
            className={cn(
              'w-0.5 flex-1 rounded-full transition-colors',
              statut === 'TERMINE' ? 'bg-emerald-300' : 'bg-ardoise-200',
            )}
          />
        )}
      </div>

      {/* Contenu */}
      <div className={cn('min-w-0 flex-1 pb-6', !active && 'opacity-55')}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[15px] font-semibold leading-tight text-ardoise-900">
            <span className="mr-1 tabular-nums text-ardoise-400">{etape.numero}.</span>
            {etape.libelle}
          </p>
          <BadgeEtape statut={statut} vueClient={vueClient} />
        </div>

        {/* Responsable et SLA — masqués au client */}
        {!vueClient && (
          <p className="mt-1 text-xs text-ardoise-500">
            {etape.responsable} · délai cible {etape.sla_heures} h
          </p>
        )}

        {/* Objectif, uniquement quand l'étape est en cours */}
        {actionnable && !evenement && (
          <p className="mt-1.5 text-sm text-ardoise-600">{etape.objectif}</p>
        )}

        {/* Motif de rejet (AC-04) */}
        {evenement?.motif_rejet && statut !== 'TERMINE' && (
          <div className="mt-2.5">
            <Encart
              ton="erreur"
              titre="Soumission rejetée"
              icone={<TriangleAlert className="size-4" />}
            >
              <p>{evenement.motif_rejet}</p>
              <p className="mt-1 text-xs opacity-80">
                Par {evenement.valide_par} · {formatDateHeure(evenement.valide_at)}
              </p>
            </Encart>
          </div>
        )}

        {/* Données saisies */}
        {champsRenseignes.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-lg bg-ardoise-50 px-3 py-2.5 sm:grid-cols-2">
            {champsRenseignes.map((c) => (
              <div key={c.cle} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-ardoise-400">
                  {c.libelle}
                </dt>
                <dd className="truncate text-sm font-medium text-ardoise-800">
                  {evenement?.donnees[c.cle]}
                  {c.unite && <span className="ml-0.5 font-normal text-ardoise-500">{c.unite}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Commentaire terrain */}
        {evenement?.commentaire && (
          <p className="mt-2.5 flex gap-2 text-sm text-ardoise-600">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-ardoise-400" />
            <span className="min-w-0">{evenement.commentaire}</span>
          </p>
        )}

        {/* Preuves */}
        {documents.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {documents.map((d) => (
              <Preuve key={d.id} document={d} />
            ))}
          </div>
        )}

        {/* Preuves manquantes — visible en interne uniquement */}
        {!vueClient && active && statut !== 'TERMINE' && (
          <PreuvesManquantes etape={etape} documents={documents} />
        )}

        {/* Traçabilité : qui, quand, où (§12.10) */}
        {evenement && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ardoise-400">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" />
              {evenement.auteur_nom}
            </span>
            <span title={formatDateHeure(evenement.created_at)}>
              {formatDateHeure(evenement.created_at)}
            </span>
            {evenement.position_lib && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{evenement.position_lib}</span>
                {evenement.position_source === 'GPS' && (
                  <span className="rounded bg-ardoise-100 px-1 text-[10px] font-medium text-ardoise-500">
                    GPS
                  </span>
                )}
              </span>
            )}
            {evenement.valide_par && statut === 'TERMINE' && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <ShieldCheck className="size-3" />
                Validé par {evenement.valide_par}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {!vueClient && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actionnable && statut !== 'EN_ATTENTE_VALIDATION' && onMettreAJour && (
              <Bouton taille="sm" onClick={onMettreAJour}>
                Mettre à jour l’étape
              </Bouton>
            )}

            {statut === 'EN_ATTENTE_VALIDATION' && evenement && peutValider && (
              <>
                <Bouton taille="sm" variante="succes" onClick={() => onValider?.(evenement)}>
                  <Check className="size-4" />
                  Approuver
                </Bouton>
                <Bouton taille="sm" variante="secondaire" onClick={() => onRejeter?.(evenement)}>
                  Rejeter
                </Bouton>
              </>
            )}

            {statut === 'EN_ATTENTE_VALIDATION' && !peutValider && (
              <p className="text-xs italic text-violet-600">
                Soumis pour validation — un responsable opérations doit approuver.
              </p>
            )}
          </div>
        )}

        {/* Camion bloqué : l'avancement est suspendu */}
        {statut === 'BLOQUE' && (
          <p className="mt-2 text-xs font-medium text-red-700">
            {vueClient
              ? 'Nos équipes traitent actuellement ce blocage.'
              : 'Avancement suspendu jusqu’à la résolution de l’incident critique.'}
          </p>
        )}
      </div>
    </div>
  )
}

/** Rappel des preuves obligatoires encore absentes (anticipation d'AC-03). */
function PreuvesManquantes({
  etape,
  documents,
}: {
  etape: EtapeReferentiel
  documents: Document[]
}) {
  const presents = new Set(documents.map((d) => d.type))
  const manquants = etape.documents_requis.filter((t) => !presents.has(t))
  if (manquants.length === 0) return null

  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ambre-700">
      <span className="font-medium">Preuves obligatoires manquantes :</span>
      {manquants.map((t) => (
        <span
          key={t}
          className="rounded-md border border-dashed border-ambre-300 bg-ambre-50 px-1.5 py-0.5"
        >
          {libelleDocument(t)}
        </span>
      ))}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Chronologie complète                                                */
/* ------------------------------------------------------------------ */

export function Chronologie({
  camion,
  referentiel,
  evenements,
  documents,
  vueClient = false,
  peutSaisir = false,
  peutValider = false,
  onMettreAJour,
  onValider,
  onRejeter,
}: {
  camion: Camion
  referentiel: EtapeReferentiel[]
  evenements: EtapeEvenement[]
  documents: Document[]
  vueClient?: boolean
  peutSaisir?: boolean
  peutValider?: boolean
  onMettreAJour?: (etape: EtapeReferentiel) => void
  onValider?: (e: EtapeEvenement) => void
  onRejeter?: (e: EtapeEvenement) => void
}) {
  return (
    <div>
      {referentiel.map((etape, index) => (
        <Fragment key={etape.numero}>
          <Etape
            etape={etape}
            statut={statutEtape(camion, etape.numero, evenements, referentiel)}
            evenement={dernierEvenementEtape(evenements, etape.numero)}
            documents={documents.filter((d) => d.etape_numero === etape.numero)}
            derniere={index === referentiel.length - 1}
            actionnable={peutSaisir && etapeActionnable(camion, etape.numero)}
            vueClient={vueClient}
            peutValider={peutValider}
            onMettreAJour={onMettreAJour ? () => onMettreAJour(etape) : undefined}
            onValider={onValider}
            onRejeter={onRejeter}
          />
        </Fragment>
      ))}
    </div>
  )
}
