/**
 * Ouverture d'un incident depuis un dossier camion (§8.9).
 * Un incident CRITIQUE bascule immédiatement le camion en BLOQUÉ — la règle
 * est appliquée par un trigger Postgres, pas côté client.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import type { Camion, GraviteIncident } from '@/lib/types'
import { ErreurMetier, ouvrirIncident } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { Bouton, Champ, Encart, Etiquette, Modale, Selection, ZoneTexte } from './ui'

const CATEGORIES = [
  { valeur: 'DOUANE' },
  { valeur: 'RETARD' },
  { valeur: 'PANNE' },
  { valeur: 'ACCIDENT' },
  { valeur: 'DOCUMENT' },
  { valeur: 'QUANTITE' },
  { valeur: 'QUALITE' },
  { valeur: 'SECURITE' },
  { valeur: 'AUTRE' },
]

const GRAVITES: { valeur: GraviteIncident; classe: string }[] = [
  { valeur: 'FAIBLE', classe: 'bg-ardoise-100 text-ardoise-700 ring-ardoise-300' },
  { valeur: 'MOYENNE', classe: 'bg-ambre-50 text-ambre-700 ring-ambre-300' },
  { valeur: 'ELEVEE', classe: 'bg-orange-50 text-orange-700 ring-orange-300' },
  { valeur: 'CRITIQUE', classe: 'bg-red-50 text-red-700 ring-red-400' },
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
  const { t } = useTranslation(['common', 'workflow'])
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
          ? t('incidentModal.successCritical')
          : t('incidentModal.successStandard'),
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
      titre={t('incidentModal.title')}
      sousTitre={`${camion.reference} · étape ${camion.etape_courante}`}
      pied={
        <Bouton
          variante={gravite === 'CRITIQUE' ? 'danger' : 'principal'}
          className="w-full"
          disabled={envoi || !description.trim()}
          onClick={() => void enregistrer()}
        >
          {envoi ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
          {t('incidentModal.save')}
        </Bouton>
      }
    >
      <div className="space-y-4">
        {erreur && <Encart ton="erreur">{erreur}</Encart>}

        <div>
          <Etiquette htmlFor="categorie" obligatoire>
            {t('incidentModal.category')}
          </Etiquette>
          <Selection
            id="categorie"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {t(`incidentModal.categories.${c.valeur}`)}
              </option>
            ))}
          </Selection>
        </div>

        <div>
          <Etiquette obligatoire>{t('incidentModal.gravity')}</Etiquette>
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
                {t(`incidentModal.gravities.${g.valeur}`)}
              </button>
            ))}
          </div>
        </div>

        {gravite === 'CRITIQUE' && (
          <Encart ton="erreur" icone={<ShieldAlert className="size-4" />}>
            {t('incidentModal.warning')}
          </Encart>
        )}

        <div>
          <Etiquette htmlFor="description" obligatoire>
            {t('incidentModal.description')}
          </Etiquette>
          <ZoneTexte
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('incidentModal.descriptionPlaceholder')}
          />
        </div>

        <div>
          <Etiquette htmlFor="responsable">{t('incidentModal.responsible')}</Etiquette>
          <Champ
            id="responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            placeholder={t('incidentModal.responsiblePlaceholder')}
          />
        </div>

        <div>
          <Etiquette htmlFor="plan">{t('incidentModal.actionPlan')}</Etiquette>
          <ZoneTexte
            id="plan"
            value={planAction}
            onChange={(e) => setPlanAction(e.target.value)}
            placeholder={t('incidentModal.actionPlanPlaceholder')}
          />
        </div>
      </div>
    </Modale>
  )
}
