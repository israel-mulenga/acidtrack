/**
 * Ouverture d'un incident depuis un dossier camion (§8.9).
 * Un incident CRITIQUE bascule immédiatement le camion en BLOQUÉ — la règle
 * est appliquée par un trigger Postgres, pas côté client.
 */

import { useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import type { Camion, GraviteIncident } from '@/lib/types'
import { ErreurMetier, ouvrirIncident } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { Bouton, Champ, Encart, Etiquette, Modale, Selection, ZoneTexte } from './ui'

const CATEGORIES = [
  { valeur: 'DOUANE', libelle: 'Blocage douane' },
  { valeur: 'RETARD', libelle: 'Retard' },
  { valeur: 'PANNE', libelle: 'Panne véhicule' },
  { valeur: 'ACCIDENT', libelle: 'Accident' },
  { valeur: 'DOCUMENT', libelle: 'Document manquant ou rejeté' },
  { valeur: 'QUANTITE', libelle: 'Écart de quantité' },
  { valeur: 'QUALITE', libelle: 'Non-conformité qualité' },
  { valeur: 'SECURITE', libelle: 'Sécurité' },
  { valeur: 'AUTRE', libelle: 'Autre' },
]

const GRAVITES: { valeur: GraviteIncident; libelle: string; classe: string }[] = [
  { valeur: 'FAIBLE', libelle: 'Faible', classe: 'bg-ardoise-100 text-ardoise-700 ring-ardoise-300' },
  { valeur: 'MOYENNE', libelle: 'Moyenne', classe: 'bg-ambre-50 text-ambre-700 ring-ambre-300' },
  { valeur: 'ELEVEE', libelle: 'Élevée', classe: 'bg-orange-50 text-orange-700 ring-orange-300' },
  { valeur: 'CRITIQUE', libelle: 'Critique', classe: 'bg-red-50 text-red-700 ring-red-400' },
]

export function ModaleIncident({
  ouverte,
  onFermer,
  camion,
  auteur,
  onSucces,
}: {
  ouverte: boolean
  onFermer: () => void
  camion: Camion
  auteur: string
  onSucces: (message: string) => void
}) {
  const [categorie, setCategorie] = useState('DOUANE')
  const [gravite, setGravite] = useState<GraviteIncident>('MOYENNE')
  const [description, setDescription] = useState('')
  const [responsable, setResponsable] = useState('')
  const [planAction, setPlanAction] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const reinitialiser = () => {
    setCategorie('DOUANE')
    setGravite('MOYENNE')
    setDescription('')
    setResponsable('')
    setPlanAction('')
    setErreur(null)
  }

  const enregistrer = async () => {
    setEnvoi(true)
    setErreur(null)
    try {
      await ouvrirIncident({
        camion,
        etapeNumero: camion.etape_courante,
        categorie,
        gravite,
        description,
        responsable,
        planAction,
        auteur,
      })
      onSucces(
        gravite === 'CRITIQUE'
          ? 'Incident critique enregistré : le camion passe en statut BLOQUÉ.'
          : 'Incident enregistré et visible dans le dossier.',
      )
      reinitialiser()
      onFermer()
    } catch (e) {
      setErreur(e instanceof ErreurMetier ? e.message : String(e))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modale
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Signaler un incident"
      sousTitre={`${camion.reference} · étape ${camion.etape_courante}`}
      pied={
        <Bouton
          variante={gravite === 'CRITIQUE' ? 'danger' : 'principal'}
          className="w-full"
          disabled={envoi || !description.trim()}
          onClick={() => void enregistrer()}
        >
          {envoi ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
          Enregistrer l’incident
        </Bouton>
      }
    >
      <div className="space-y-4">
        {erreur && <Encart ton="erreur">{erreur}</Encart>}

        <div>
          <Etiquette htmlFor="categorie" obligatoire>
            Catégorie
          </Etiquette>
          <Selection
            id="categorie"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </Selection>
        </div>

        <div>
          <Etiquette obligatoire>Gravité</Etiquette>
          <div className="grid grid-cols-4 gap-1.5">
            {GRAVITES.map((g) => (
              <button
                key={g.valeur}
                type="button"
                onClick={() => setGravite(g.valeur)}
                className={cn(
                  'rounded-lg py-2 text-xs font-semibold ring-1 ring-inset transition-all',
                  gravite === g.valeur
                    ? `${g.classe} ring-2`
                    : 'bg-white text-ardoise-500 ring-ardoise-200 hover:bg-ardoise-50',
                )}
              >
                {g.libelle}
              </button>
            ))}
          </div>
        </div>

        {gravite === 'CRITIQUE' && (
          <Encart ton="erreur" icone={<ShieldAlert className="size-4" />}>
            Un incident critique bascule automatiquement le camion en statut{' '}
            <strong>BLOQUÉ</strong> et suspend son avancement jusqu’à résolution.
          </Encart>
        )}

        <div>
          <Etiquette htmlFor="description" obligatoire>
            Description
          </Etiquette>
          <ZoneTexte
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ce qui s’est passé, où, et depuis quand."
          />
        </div>

        <div>
          <Etiquette htmlFor="responsable">Responsable du traitement</Etiquette>
          <Champ
            id="responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            placeholder="Ex. : Copperfield Clearing"
          />
        </div>

        <div>
          <Etiquette htmlFor="plan">Plan d’action</Etiquette>
          <ZoneTexte
            id="plan"
            value={planAction}
            onChange={(e) => setPlanAction(e.target.value)}
            placeholder="Prochaine action, échéance et interlocuteur."
          />
        </div>
      </div>
    </Modale>
  )
}
