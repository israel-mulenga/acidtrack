/**
 * Création en série des dossiers camions d'un lot (critère AC-01).
 *
 * Créer cinq dossiers un par un serait cinq fois le même formulaire. On
 * saisit ici un gabarit commun, puis seules les plaques et les tonnages
 * varient. Les références sont générées et le tonnage restant du lot est
 * contrôlé en direct.
 */

import { useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, TriangleAlert, Truck } from 'lucide-react'
import type { Camion, Lot } from '@/lib/types'
import { ErreurMetier } from '@/lib/actions'
import { creerCamionsEnSerie, tonnageAffecte, type GabaritCamion } from '@/lib/crud'
import { referencesCamions } from '@/lib/references'
import { cn, formatTonnage } from '@/lib/utils'
import { Bouton, Champ, Encart, Etiquette, Modale } from './ui'

interface Ligne {
  plaque_tracteur: string
  plaque_citerne: string
  chauffeur_nom: string
  chauffeur_tel: string
  tonnage_net_t: string
}

const LIGNE_VIDE: Ligne = {
  plaque_tracteur: '',
  plaque_citerne: '',
  chauffeur_nom: '',
  chauffeur_tel: '',
  tonnage_net_t: '',
}

export function AssistantCamions({
  lot,
  camions,
  onFermer,
  onSucces,
}: {
  lot: Lot | null
  camions: Camion[]
  onFermer: () => void
  onSucces: (message: string) => void
}) {
  const [transporteur, setTransporteur] = useState('')
  const [tonnageParDefaut, setTonnageParDefaut] = useState('')
  const [lignes, setLignes] = useState<Ligne[]>([{ ...LIGNE_VIDE }])
  const [envoi, setEnvoi] = useState(false)
  const [erreurs, setErreurs] = useState<string[]>([])

  const restant = lot
    ? Number(lot.quantite_planifiee_t) - tonnageAffecte(lot.id, camions)
    : 0

  const total = lignes.reduce((somme, l) => somme + (Number(l.tonnage_net_t) || 0), 0)
  const depassement = total > restant + 0.001

  const references = useMemo(
    () => (lot ? referencesCamions(lot, camions, lignes.length) : []),
    [lot, camions, lignes.length],
  )

  const majLigne = (index: number, cle: keyof Ligne, valeur: string) =>
    setLignes((prec) =>
      prec.map((l, i) => (i === index ? { ...l, [cle]: valeur } : l)),
    )

  const ajouterLigne = () =>
    setLignes((prec) => [
      ...prec,
      { ...LIGNE_VIDE, tonnage_net_t: tonnageParDefaut },
    ])

  const retirerLigne = (index: number) =>
    setLignes((prec) => (prec.length === 1 ? prec : prec.filter((_, i) => i !== index)))

  /** Génère d'un coup le nombre de lignes souhaité. */
  const preparer = (nombre: number) => {
    setLignes(
      Array.from({ length: nombre }, () => ({
        ...LIGNE_VIDE,
        tonnage_net_t: tonnageParDefaut,
      })),
    )
  }

  /** Applique le tonnage par défaut aux lignes encore vides. */
  const appliquerTonnage = (valeur: string) => {
    setTonnageParDefaut(valeur)
    setLignes((prec) =>
      prec.map((l) => (l.tonnage_net_t ? l : { ...l, tonnage_net_t: valeur })),
    )
  }

  const reinitialiser = () => {
    setLignes([{ ...LIGNE_VIDE }])
    setTransporteur('')
    setTonnageParDefaut('')
    setErreurs([])
  }

  const enregistrer = async () => {
    if (!lot) return
    setEnvoi(true)
    setErreurs([])
    try {
      const gabarits: GabaritCamion[] = lignes.map((l) => ({
        plaque_tracteur: l.plaque_tracteur,
        plaque_citerne: l.plaque_citerne,
        transporteur,
        chauffeur_nom: l.chauffeur_nom,
        chauffeur_tel: l.chauffeur_tel,
        tonnage_net_t: Number(l.tonnage_net_t) || 0,
      }))

      const vides = gabarits.filter((g) => g.tonnage_net_t <= 0)
      if (vides.length > 0) {
        setErreurs(['Le tonnage net doit être renseigné pour chaque camion.'])
        return
      }

      const crees = await creerCamionsEnSerie({
        lot,
        camionsExistants: camions,
        gabarits,
      })

      onSucces(
        `${crees.length} dossier${crees.length > 1 ? 's' : ''} camion créé${
          crees.length > 1 ? 's' : ''
        } sur le lot ${lot.reference}.`,
      )
      reinitialiser()
      onFermer()
    } catch (e) {
      setErreurs(e instanceof ErreurMetier ? [e.message, ...e.details] : [String(e)])
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modale
      ouverte={!!lot}
      onFermer={onFermer}
      titre="Ajouter des dossiers camions"
      sousTitre={lot ? `${lot.reference} · ${lot.destination}` : undefined}
      pied={
        <div className="flex gap-2">
          <Bouton variante="secondaire" className="flex-1" onClick={onFermer} disabled={envoi}>
            Annuler
          </Bouton>
          <Bouton
            className="flex-[2]"
            onClick={() => void enregistrer()}
            disabled={envoi || depassement}
          >
            {envoi ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
            Créer {lignes.length} dossier{lignes.length > 1 ? 's' : ''}
          </Bouton>
        </div>
      }
    >
      <div className="space-y-4">
        {erreurs.length > 0 && (
          <Encart ton="erreur" titre="Création impossible" icone={<TriangleAlert className="size-4" />}>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {erreurs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Encart>
        )}

        {/* Compteur de tonnage */}
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-3.5 py-3 text-sm',
            depassement
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-ardoise-200 bg-ardoise-50 text-ardoise-700',
          )}
        >
          <span>Tonnage à affecter</span>
          <span className="font-semibold tabular-nums">
            {formatTonnage(total)}
            <span className="font-normal text-ardoise-400"> / {formatTonnage(restant)}</span>
          </span>
        </div>

        {/* Gabarit commun */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Etiquette htmlFor="transporteur">Transporteur</Etiquette>
            <Champ
              id="transporteur"
              value={transporteur}
              onChange={(e) => setTransporteur(e.target.value)}
              placeholder="Appliqué à tous les camions"
            />
          </div>
          <div>
            <Etiquette htmlFor="tonnage-defaut">
              Tonnage par camion <span className="font-normal text-ardoise-400">(t)</span>
            </Etiquette>
            <Champ
              id="tonnage-defaut"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tonnageParDefaut}
              onChange={(e) => appliquerTonnage(e.target.value)}
              placeholder="Ex. : 30"
            />
          </div>
        </div>

        {/* Génération rapide */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ardoise-500">Préparer</span>
          {[2, 3, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => preparer(n)}
              className="rounded-full bg-white px-3 py-1 text-sm font-medium text-ardoise-600 ring-1 ring-inset ring-ardoise-200 transition-colors hover:bg-ardoise-50"
            >
              {n} camions
            </button>
          ))}
        </div>

        {/* Lignes */}
        <div className="space-y-3">
          {lignes.map((ligne, index) => (
            <div
              key={index}
              className="rounded-lg border border-ardoise-200 bg-ardoise-50/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ardoise-500">
                  {references[index]}
                </span>
                {lignes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => retirerLigne(index)}
                    aria-label={`Retirer le camion ${index + 1}`}
                    className="rounded-md p-1 text-ardoise-400 transition-colors hover:bg-white hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Champ
                  value={ligne.plaque_tracteur}
                  onChange={(e) => majLigne(index, 'plaque_tracteur', e.target.value)}
                  placeholder="Plaque tracteur *"
                  aria-label={`Plaque tracteur du camion ${index + 1}`}
                />
                <Champ
                  value={ligne.plaque_citerne}
                  onChange={(e) => majLigne(index, 'plaque_citerne', e.target.value)}
                  placeholder="Plaque citerne"
                  aria-label={`Plaque citerne du camion ${index + 1}`}
                />
                <Champ
                  value={ligne.chauffeur_nom}
                  onChange={(e) => majLigne(index, 'chauffeur_nom', e.target.value)}
                  placeholder="Chauffeur"
                  aria-label={`Chauffeur du camion ${index + 1}`}
                />
                <Champ
                  type="tel"
                  value={ligne.chauffeur_tel}
                  onChange={(e) => majLigne(index, 'chauffeur_tel', e.target.value)}
                  placeholder="Téléphone"
                  aria-label={`Téléphone du camion ${index + 1}`}
                />
                <Champ
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={ligne.tonnage_net_t}
                  onChange={(e) => majLigne(index, 'tonnage_net_t', e.target.value)}
                  placeholder="Tonnage net (t) *"
                  aria-label={`Tonnage du camion ${index + 1}`}
                  className="col-span-2"
                />
              </div>
            </div>
          ))}
        </div>

        <Bouton variante="secondaire" className="w-full" onClick={ajouterLigne}>
          <Plus className="size-4" />
          Ajouter un camion
        </Bouton>
      </div>
    </Modale>
  )
}
