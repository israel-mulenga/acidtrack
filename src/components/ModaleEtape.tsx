/**
 * Formulaire guidé de mise à jour d'une étape.
 *
 * Objectif UX (§10) : mettre à jour une étape en moins d'une minute sur
 * téléphone. Le formulaire est généré à partir du référentiel : les champs,
 * les options d'itinéraire et les preuves obligatoires proviennent de la base.
 */

import { useMemo, useRef, useState } from 'react'
import {
  Camera,
  Check,
  Loader2,
  LocateFixed,
  Paperclip,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import type {
  Camion,
  Document,
  EtapeEvenement,
  EtapeReferentiel,
  RoleUtilisateur,
} from '@/lib/types'
import {
  ErreurMetier,
  capturerPosition,
  soumettreEtape,
  type PreuveALoader,
} from '@/lib/actions'
import { controleDocumentaire, libelleDocument, optionsChamp } from '@/lib/workflow'
import { cn, formatTaille, maintenantLocal, aujourdhuiLocal } from '@/lib/utils'
import {
  Bouton,
  Champ,
  Encart,
  Etiquette,
  Modale,
  Selection,
  ZoneTexte,
} from './ui'

interface Position {
  lat: number
  lng: number
  libelle: string
  source: string
}

export function ModaleEtape({
  ouverte,
  onFermer,
  camion,
  jalons,
  etape,
  documents,
  dernierEvenement,
  auteurNom,
  auteurRole,
  autoValidation,
  onSucces,
}: {
  ouverte: boolean
  onFermer: () => void
  camion: Camion
  /** Points de contrôle de l'itinéraire du lot (masquage AC-06). */
  jalons: string[]
  etape: EtapeReferentiel
  documents: Document[]
  dernierEvenement?: EtapeEvenement
  auteurNom: string
  auteurRole: RoleUtilisateur
  autoValidation: boolean
  onSucces: (message: string) => void
}) {
  /* --- État du formulaire ------------------------------------------ */
  const [valeurs, setValeurs] = useState<Record<string, string>>(
    () => dernierEvenement?.donnees ?? {},
  )
  const [commentaire, setCommentaire] = useState('')
  const [position, setPosition] = useState<Position | null>(null)
  const [lieuManuel, setLieuManuel] = useState(camion.derniere_position_lib ?? '')
  const [preuves, setPreuves] = useState<PreuveALoader[]>([])
  const [typePreuve, setTypePreuve] = useState<string>('')
  const [envoi, setEnvoi] = useState(false)
  const [gps, setGps] = useState(false)
  const [erreur, setErreur] = useState<ErreurMetier | null>(null)

  const inputFichier = useRef<HTMLInputElement>(null)

  /* --- Contrôle documentaire en direct ------------------------------ */
  const controle = useMemo(
    () =>
      controleDocumentaire(
        etape,
        documents,
        preuves.map((p) => p.type),
      ),
    [etape, documents, preuves],
  )

  const typesProposables = useMemo(() => {
    const suggeres = [...etape.documents_requis, 'PHOTO', 'AUTRE']
    return [...new Set(suggeres)]
  }, [etape])

  /* --- Actions ------------------------------------------------------ */

  const majValeur = (cle: string, valeur: string) =>
    setValeurs((v) => ({ ...v, [cle]: valeur }))

  const localiser = async () => {
    setGps(true)
    setErreur(null)
    try {
      const { lat, lng } = await capturerPosition()
      setPosition({
        lat,
        lng,
        libelle: lieuManuel || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        source: 'GPS',
      })
    } catch (e) {
      setErreur(e instanceof ErreurMetier ? e : new ErreurMetier(String(e)))
    } finally {
      setGps(false)
    }
  }

  const ajouterFichiers = (fichiers: FileList | null) => {
    if (!fichiers?.length) return
    const type = typePreuve || controle.manquants[0] || 'AUTRE'
    setPreuves((p) => [...p, ...Array.from(fichiers).map((fichier) => ({ type, fichier }))])
    setTypePreuve('')
    if (inputFichier.current) inputFichier.current.value = ''
  }

  const retirerPreuve = (index: number) =>
    setPreuves((p) => p.filter((_, i) => i !== index))

  const soumettre = async (brouillon: boolean) => {
    setEnvoi(true)
    setErreur(null)
    try {
      const positionFinale: Position | null = position
        ? { ...position, libelle: lieuManuel || position.libelle }
        : lieuManuel
          ? { lat: 0, lng: 0, libelle: lieuManuel, source: 'MANUEL' }
          : null

      const resultat = await soumettreEtape({
        camion,
        etape,
        valeurs,
        commentaire,
        position:
          positionFinale && positionFinale.source === 'MANUEL'
            ? { lat: 0, lng: 0, libelle: positionFinale.libelle, source: 'MANUEL' }
            : positionFinale,
        preuves,
        documentsExistants: documents,
        auteurNom,
        auteurRole,
        autoValidation,
        brouillon,
      })

      onSucces(
        brouillon
          ? 'Progression enregistrée sur l’étape en cours.'
          : resultat.cloturee
            ? `Étape ${etape.numero} validée. Le camion passe à l’étape suivante.`
            : 'Étape soumise. Un responsable opérations doit maintenant l’approuver.',
      )
      onFermer()
    } catch (e) {
      setErreur(e instanceof ErreurMetier ? e : new ErreurMetier(String(e)))
    } finally {
      setEnvoi(false)
    }
  }

  /* --- Rendu -------------------------------------------------------- */

  return (
    <Modale
      ouverte={ouverte}
      onFermer={onFermer}
      titre={`Étape ${etape.numero} — ${etape.libelle}`}
      sousTitre={`${camion.reference} · ${camion.plaque_tracteur}`}
      pied={
        <div className="flex gap-2">
          <Bouton
            variante="secondaire"
            className="flex-1"
            disabled={envoi}
            onClick={() => void soumettre(true)}
          >
            Enregistrer
          </Bouton>
          <Bouton
            className="flex-[2]"
            disabled={envoi}
            onClick={() => void soumettre(false)}
          >
            {envoi ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {autoValidation ? 'Valider l’étape' : 'Soumettre pour validation'}
          </Bouton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Erreur métier — c'est ici que se joue AC-03 */}
        {erreur && (
          <Encart ton="erreur" titre={erreur.message} icone={<TriangleAlert className="size-4" />}>
            {erreur.details.length > 0 && (
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {erreur.details.map((d) => (
                  <li key={d}>{libelleDocument(d)}</li>
                ))}
              </ul>
            )}
          </Encart>
        )}

        <p className="text-sm text-ardoise-600">{etape.objectif}</p>

        {/* Champs métier dynamiques */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {etape.champs.map((champ) => {
            const id = `champ-${champ.cle}`
            const options = optionsChamp(champ.cle, champ.options, jalons)
            return (
              <div
                key={champ.cle}
                className={cn(champ.type === 'textarea' && 'sm:col-span-2')}
              >
                <Etiquette htmlFor={id} obligatoire={champ.obligatoire}>
                  {champ.libelle}
                  {champ.unite && (
                    <span className="ml-1 font-normal text-ardoise-400">({champ.unite})</span>
                  )}
                </Etiquette>

                {champ.type === 'select' ? (
                  <Selection
                    id={id}
                    value={valeurs[champ.cle] ?? ''}
                    onChange={(e) => majValeur(champ.cle, e.target.value)}
                  >
                    <option value="">Sélectionner…</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Selection>
                ) : champ.type === 'textarea' ? (
                  <ZoneTexte
                    id={id}
                    value={valeurs[champ.cle] ?? ''}
                    onChange={(e) => majValeur(champ.cle, e.target.value)}
                  />
                ) : (
                  <Champ
                    id={id}
                    type={
                      champ.type === 'datetime'
                        ? 'datetime-local'
                        : champ.type === 'date'
                          ? 'date'
                          : champ.type === 'number'
                            ? 'number'
                            : 'text'
                    }
                    inputMode={champ.type === 'number' ? 'decimal' : undefined}
                    step={champ.type === 'number' ? '0.01' : undefined}
                    value={valeurs[champ.cle] ?? ''}
                    // Date/heure préremplies à maintenant (§8.3.3)
                    onFocus={() => {
                      if (valeurs[champ.cle]) return
                      if (champ.type === 'datetime') majValeur(champ.cle, maintenantLocal())
                      if (champ.type === 'date') majValeur(champ.cle, aujourdhuiLocal())
                    }}
                    onChange={(e) => majValeur(champ.cle, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Preuves */}
        <div>
          <Etiquette obligatoire={etape.documents_requis.length > 0}>Preuves</Etiquette>

          {/* Rappel des pièces obligatoires et de leur statut */}
          {etape.documents_requis.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {etape.documents_requis.map((t) => {
                const present = !controle.manquants.includes(t)
                return (
                  <span
                    key={t}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                      present
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                        : 'border border-dashed border-ambre-300 bg-ambre-50 text-ambre-700',
                    )}
                  >
                    {present && <Check className="size-3" />}
                    {libelleDocument(t)}
                  </span>
                )
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Selection
              value={typePreuve}
              onChange={(e) => setTypePreuve(e.target.value)}
              aria-label="Type de document"
              className="flex-1"
            >
              <option value="">Type de document…</option>
              {typesProposables.map((t) => (
                <option key={t} value={t}>
                  {libelleDocument(t)}
                </option>
              ))}
            </Selection>
            <Bouton
              variante="secondaire"
              type="button"
              onClick={() => inputFichier.current?.click()}
              aria-label="Joindre un fichier"
            >
              <Paperclip className="size-4" />
              <span className="hidden sm:inline">Joindre</span>
            </Bouton>
          </div>

          {/* `capture` ouvre directement l'appareil photo sur mobile */}
          <input
            ref={inputFichier}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => ajouterFichiers(e.target.files)}
          />

          <button
            type="button"
            onClick={() => inputFichier.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ardoise-200 bg-ardoise-50/50 py-3 text-sm text-ardoise-500 transition-colors hover:border-ardoise-300 hover:bg-ardoise-50"
          >
            <Camera className="size-4" />
            Prendre une photo ou choisir un fichier
          </button>

          {preuves.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {preuves.map((p, i) => (
                <li
                  key={`${p.fichier.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-ardoise-200 bg-white px-2.5 py-2 text-sm"
                >
                  <Upload className="size-3.5 shrink-0 text-ardoise-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ardoise-800">{p.fichier.name}</span>
                    <span className="block text-xs text-ardoise-400">
                      {libelleDocument(p.type)} · {formatTaille(p.fichier.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => retirerPreuve(i)}
                    aria-label="Retirer"
                    className="shrink-0 rounded-md p-1 text-ardoise-400 hover:bg-ardoise-100 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Position */}
        <div>
          <Etiquette>Position</Etiquette>
          <div className="flex gap-2">
            <Champ
              value={lieuManuel}
              onChange={(e) => setLieuManuel(e.target.value)}
              placeholder="Lieu (saisie manuelle)"
              className="flex-1"
            />
            <Bouton
              variante="secondaire"
              type="button"
              onClick={() => void localiser()}
              disabled={gps}
              aria-label="Capturer la position GPS"
            >
              {gps ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LocateFixed className={cn('size-4', position && 'text-emerald-600')} />
              )}
              <span className="hidden sm:inline">GPS</span>
            </Bouton>
          </div>
          {position && (
            <p className="mt-1.5 text-xs text-emerald-600">
              Position GPS capturée : {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Commentaire */}
        <div>
          <Etiquette htmlFor="commentaire">Commentaire</Etiquette>
          <ZoneTexte
            id="commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Observation terrain, cause d’un retard, précision utile…"
          />
        </div>

        {!autoValidation && (
          <p className="text-xs text-ardoise-500">
            Votre soumission sera transmise aux opérations pour approbation : vous ne validez pas
            votre propre saisie.
          </p>
        )}
      </div>
    </Modale>
  )
}
