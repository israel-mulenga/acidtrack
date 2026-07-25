/**
 * Gestion générique d'une ressource : liste, recherche, création, édition,
 * suppression. Chaque écran d'administration se réduit à une déclaration de
 * colonnes et de champs — la mécanique est mutualisée ici.
 */

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, Pencil, Plus, Search, Trash2, TriangleAlert } from 'lucide-react'
import { ErreurMetier } from '@/lib/actions'
import { cn } from '@/lib/utils'
import {
  Bouton,
  Carte,
  Champ,
  Encart,
  EtatVide,
  Etiquette,
  Modale,
  Selection,
  ZoneTexte,
} from './ui'

/* ------------------------------------------------------------------ */
/* Déclaration d'un formulaire                                         */
/* ------------------------------------------------------------------ */

export type TypeChampFormulaire =
  | 'texte'
  | 'nombre'
  | 'tel'
  | 'date'
  | 'liste'
  | 'zone'
  | 'booleen'

export interface ChampFormulaire {
  cle: string
  libelle: string
  type: TypeChampFormulaire
  obligatoire?: boolean
  options?: { valeur: string; libelle: string }[]
  aide?: string
  unite?: string
  pleineLargeur?: boolean
  lectureSeule?: boolean
}

export interface ColonneRessource<T> {
  cle: string
  libelle: string
  rendu: (element: T) => ReactNode
  masquerMobile?: boolean
}

export type ValeursFormulaire = Record<string, string | boolean>

/* ------------------------------------------------------------------ */
/* Composant                                                           */
/* ------------------------------------------------------------------ */

export function CrudRessource<T extends { id: string }>({
  titre,
  description,
  icone,
  elements,
  colonnes,
  champs,
  valeursInitiales,
  rechercheDans,
  libelleElement,
  onEnregistrer,
  onSupprimer,
  valider,
  actionsSupplementaires,
  libelleCreation = 'Nouveau',
  pasDeCreation = false,
}: {
  titre: string
  description?: string
  icone?: ReactNode
  elements: T[]
  colonnes: ColonneRessource<T>[]
  champs: (element: T | null) => ChampFormulaire[]
  valeursInitiales: (element: T | null) => ValeursFormulaire
  rechercheDans: (element: T) => string
  libelleElement: (element: T) => string
  onEnregistrer: (valeurs: ValeursFormulaire, element: T | null) => Promise<void>
  onSupprimer?: (element: T) => Promise<void>
  /** Contrôles métier ; renvoie la liste des erreurs, vide si tout va bien. */
  valider?: (valeurs: ValeursFormulaire, element: T | null) => string[]
  actionsSupplementaires?: (element: T) => ReactNode
  libelleCreation?: string
  /** Masque la création : ressource gérée uniquement en modification. */
  pasDeCreation?: boolean
}) {
  const [recherche, setRecherche] = useState('')
  const [edition, setEdition] = useState<{ ouvert: boolean; element: T | null }>({
    ouvert: false,
    element: null,
  })
  const [valeurs, setValeurs] = useState<ValeursFormulaire>({})
  const [aSupprimer, setASupprimer] = useState<T | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    if (!terme) return elements
    return elements.filter((e) => rechercheDans(e).toLowerCase().includes(terme))
  }, [elements, recherche, rechercheDans])

  const ouvrir = (element: T | null) => {
    setValeurs(valeursInitiales(element))
    setErreurs([])
    setEdition({ ouvert: true, element })
  }

  const fermer = () => setEdition({ ouvert: false, element: null })

  const enregistrer = async () => {
    const schema = champs(edition.element)
    const manquants = schema
      .filter((c) => c.obligatoire && !String(valeurs[c.cle] ?? '').trim())
      .map((c) => `${c.libelle} est obligatoire.`)

    const metier = valider?.(valeurs, edition.element) ?? []
    const toutes = [...manquants, ...metier]

    if (toutes.length > 0) {
      setErreurs(toutes)
      return
    }

    setEnvoi(true)
    setErreurs([])
    try {
      await onEnregistrer(valeurs, edition.element)
      fermer()
    } catch (e) {
      setErreurs(
        e instanceof ErreurMetier ? [e.message, ...e.details] : [String(e)],
      )
    } finally {
      setEnvoi(false)
    }
  }

  const confirmerSuppression = async () => {
    if (!aSupprimer || !onSupprimer) return
    setEnvoi(true)
    try {
      await onSupprimer(aSupprimer)
      setASupprimer(null)
    } catch (e) {
      setErreurs(e instanceof ErreurMetier ? [e.message] : [String(e)])
    } finally {
      setEnvoi(false)
    }
  }

  const schema = champs(edition.element)

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ardoise-900">
            {icone}
            {titre}
          </h2>
          {description && <p className="mt-0.5 text-sm text-ardoise-500">{description}</p>}
        </div>
        {!pasDeCreation && (
          <Bouton onClick={() => ouvrir(null)}>
            <Plus className="size-4" />
            {libelleCreation}
          </Bouton>
        )}
      </div>

      {/* Recherche */}
      {elements.length > 5 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ardoise-400" />
          <Champ
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher…"
            className="pl-9"
          />
        </div>
      )}

      {/* Liste */}
      {filtres.length === 0 ? (
        <EtatVide
          titre={recherche ? 'Aucun résultat' : `Aucun élément`}
          description={
            recherche
              ? 'Affinez votre recherche.'
              : 'Créez le premier enregistrement pour commencer.'
          }
          action={
            !recherche && !pasDeCreation ? (
              <Bouton onClick={() => ouvrir(null)}>
                <Plus className="size-4" />
                {libelleCreation}
              </Bouton>
            ) : undefined
          }
        />
      ) : (
        <Carte className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ardoise-200 bg-ardoise-50/60">
                  {colonnes.map((c) => (
                    <th
                      key={c.cle}
                      className={cn(
                        'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ardoise-500',
                        c.masquerMobile && 'hidden sm:table-cell',
                      )}
                    >
                      {c.libelle}
                    </th>
                  ))}
                  <th className="w-px px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ardoise-100">
                {filtres.map((element) => (
                  <tr key={element.id} className="transition-colors hover:bg-ardoise-50/60">
                    {colonnes.map((c) => (
                      <td
                        key={c.cle}
                        className={cn(
                          'px-3 py-2.5 align-middle text-ardoise-700',
                          c.masquerMobile && 'hidden sm:table-cell',
                        )}
                      >
                        {c.rendu(element)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {actionsSupplementaires?.(element)}
                        <button
                          onClick={() => ouvrir(element)}
                          aria-label={`Modifier ${libelleElement(element)}`}
                          className="rounded-md p-1.5 text-ardoise-400 transition-colors hover:bg-ardoise-100 hover:text-ardoise-900"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {onSupprimer && (
                          <button
                            onClick={() => setASupprimer(element)}
                            aria-label={`Supprimer ${libelleElement(element)}`}
                            className="rounded-md p-1.5 text-ardoise-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}

      {/* Formulaire */}
      <Modale
        ouverte={edition.ouvert}
        onFermer={fermer}
        titre={edition.element ? `Modifier — ${libelleElement(edition.element)}` : libelleCreation}
        sousTitre={titre}
        pied={
          <div className="flex gap-2">
            <Bouton variante="secondaire" className="flex-1" onClick={fermer} disabled={envoi}>
              Annuler
            </Bouton>
            <Bouton className="flex-[2]" onClick={() => void enregistrer()} disabled={envoi}>
              {envoi && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Bouton>
          </div>
        }
      >
        <div className="space-y-4">
          {erreurs.length > 0 && (
            <Encart
              ton="erreur"
              titre="Corrigez les points suivants"
              icone={<TriangleAlert className="size-4" />}
            >
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Encart>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {schema.map((champ) => (
              <ChampDynamique
                key={champ.cle}
                champ={champ}
                valeur={valeurs[champ.cle]}
                onChange={(v) => setValeurs((prec) => ({ ...prec, [champ.cle]: v }))}
              />
            ))}
          </div>
        </div>
      </Modale>

      {/* Confirmation de suppression */}
      <Modale
        ouverte={!!aSupprimer}
        onFermer={() => setASupprimer(null)}
        titre="Confirmer la suppression"
        pied={
          <div className="flex gap-2">
            <Bouton
              variante="secondaire"
              className="flex-1"
              onClick={() => setASupprimer(null)}
              disabled={envoi}
            >
              Annuler
            </Bouton>
            <Bouton
              variante="danger"
              className="flex-1"
              onClick={() => void confirmerSuppression()}
              disabled={envoi}
            >
              Supprimer
            </Bouton>
          </div>
        }
      >
        <p className="text-sm text-ardoise-600">
          Supprimer définitivement{' '}
          <strong className="text-ardoise-900">
            {aSupprimer ? libelleElement(aSupprimer) : ''}
          </strong>{' '}
          ? Cette action est irréversible.
        </p>
        {erreurs.length > 0 && (
          <Encart ton="erreur" className="mt-3">
            {erreurs.join(' ')}
          </Encart>
        )}
      </Modale>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rendu d'un champ                                                    */
/* ------------------------------------------------------------------ */

function ChampDynamique({
  champ,
  valeur,
  onChange,
}: {
  champ: ChampFormulaire
  valeur: string | boolean | undefined
  onChange: (valeur: string | boolean) => void
}) {
  const id = `form-${champ.cle}`
  const texte = typeof valeur === 'boolean' ? '' : (valeur ?? '')

  if (champ.type === 'booleen') {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-ardoise-200 px-3 py-2.5 sm:col-span-2"
      >
        <input
          id={id}
          type="checkbox"
          checked={valeur === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-ardoise-300 text-ardoise-900 focus:ring-ardoise-400"
        />
        <span className="text-sm font-medium text-ardoise-700">{champ.libelle}</span>
      </label>
    )
  }

  return (
    <div className={cn((champ.pleineLargeur || champ.type === 'zone') && 'sm:col-span-2')}>
      <Etiquette htmlFor={id} obligatoire={champ.obligatoire}>
        {champ.libelle}
        {champ.unite && <span className="ml-1 font-normal text-ardoise-400">({champ.unite})</span>}
      </Etiquette>

      {champ.type === 'liste' ? (
        <Selection
          id={id}
          value={texte}
          disabled={champ.lectureSeule}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Sélectionner…</option>
          {champ.options?.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </Selection>
      ) : champ.type === 'zone' ? (
        <ZoneTexte
          id={id}
          value={texte}
          disabled={champ.lectureSeule}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Champ
          id={id}
          type={champ.type === 'nombre' ? 'number' : champ.type === 'date' ? 'date' : champ.type === 'tel' ? 'tel' : 'text'}
          inputMode={champ.type === 'nombre' ? 'decimal' : undefined}
          step={champ.type === 'nombre' ? '0.01' : undefined}
          value={texte}
          disabled={champ.lectureSeule}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {champ.aide && <p className="mt-1 text-xs text-ardoise-400">{champ.aide}</p>}
    </div>
  )
}
