/**
 * Génération des documents de sortie : pré-alerte et bundle documentaire.
 *
 * On utilise html2canvas + jsPDF pour rester 100% côté client, éviter les
 * dépendances backend et conserver le rendu multi-langue (le navigateur
 * embarque les polices système nécessaires).
 */

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import type { TFunction } from 'i18next'
import type { Camion, Client, Commande, Document, EtapeEvenement, EtapeReferentiel, Lot, Utilisateur } from './types'
import { BUCKET_PREUVES, supabase } from './supabase'
import { formatDateHeure } from './utils'

interface ContextePreAlerte {
  camion: Camion
  lot: Lot
  commande: Commande
  client: Client
  operateur: Utilisateur | null
  evenementChargement: EtapeEvenement | null
  t: TFunction<'documents'>
}

interface EtapeBundle {
  numero: number
  libelle: string
  requis: string[]
  presents: Document[]
}

function nomFichierSafe(nom: string): string {
  return nom.replace(/[^a-zA-Z0-9\-_]/g, '_')
}

/**
 * Crée une div hors écran contenant le HTML fourni, le rend avec html2canvas
 * puis génère un PDF A4 en mode portrait.
 */
async function htmlVersPdf(html: string, title: string): Promise<Blob> {
  const conteneur = document.createElement('div')
  conteneur.innerHTML = html
  conteneur.style.position = 'fixed'
  conteneur.style.top = '-9999px'
  conteneur.style.left = '-9999px'
  conteneur.style.width = '210mm'
  conteneur.style.padding = '12mm'
  conteneur.style.background = '#fff'
  conteneur.style.color = '#111'
  conteneur.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  conteneur.style.fontSize = '10pt'
  conteneur.style.lineHeight = '1.4'

  document.body.appendChild(conteneur)

  try {
    const canvas = await html2canvas(conteneur, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#fff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth - 24 // marges 12mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let position = 12
    let heightLeft = imgHeight

    pdf.addImage(imgData, 'PNG', 12, position, imgWidth, imgHeight)
    heightLeft -= pageHeight - 24

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 12
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 12, position, imgWidth, imgHeight)
      heightLeft -= pageHeight - 24
    }

    pdf.setProperties({ title })
    return pdf.output('blob')
  } finally {
    document.body.removeChild(conteneur)
  }
}

/**
 * Formate le numéro PO / Invoice selon le document client.
 */
function formaterPoInvoice(commande: Commande, t: TFunction<'documents'>): string {
  const po = commande.reference?.trim()
  const invoice = commande.numero_facture?.trim()
  if (po && invoice) return `${po} — Invoice No. ${invoice}`
  if (invoice) return `${t('preAlert.notProvided')} — Invoice No. ${invoice}`
  return po || '—'
}

/**
 * Détermine le type de livraison à afficher dans le pré-alerte.
 */
function typeLivraison(commande: Commande): string {
  const produit = (commande.produit || '').toLowerCase()
  if (produit.includes('acid') || produit.includes('sulfurique') || produit.includes('liquid')) {
    return 'Bulk Road Delivery – Tanker'
  }
  return 'Bulk Road Delivery'
}

/**
 * Sépare prénom / nom sur le premier espace.
 */
function prenomNom(nomComplet: string | null): { prenom: string; nom: string } {
  if (!nomComplet) return { prenom: '—', nom: '—' }
  const [premier, ...reste] = nomComplet.trim().split(' ')
  return { prenom: premier || '—', nom: reste.join(' ') || '—' }
}

function masseValeur(valeur: string | number | undefined, locale: string): string {
  if (valeur === undefined || valeur === null || valeur === '') return '—'
  const num = Number(valeur)
  if (Number.isNaN(num)) return String(valeur)
  return num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' kg'
}

/**
 * Génère le pré-alerte au format PDF.
 */
export async function genererPreAlertePdf(ctx: ContextePreAlerte): Promise<Blob> {
  const { camion, lot, commande, client, operateur, evenementChargement, t } = ctx
  const locale = 'fr-FR'
  const chargement = evenementChargement?.donnees ?? {}
  const chauffeur = prenomNom(camion.chauffeur_nom)
  const dateDepart = evenementChargement?.valide_at
    ? formatDateHeure(evenementChargement.valide_at)
    : formatDateHeure(camion.created_at)

  const lignes = [
    { n: 1, cle: 'plateNumber', detail: camion.plaque_tracteur || '—' },
    { n: 2, cle: 'trailerA', detail: camion.plaque_citerne || '—' },
    { n: 3, cle: 'trailerB', detail: camion.plaque_remorque_2 || t('preAlert.notApplicable') },
    { n: 4, cle: 'productName', detail: `${commande.produit}${commande.concentration ? ` — ${commande.concentration}` : ''}` },
    { n: 5, cle: 'poNumber', detail: formaterPoInvoice(commande, t) },
    { n: 6, cle: 'driverName', detail: chauffeur.prenom },
    { n: 7, cle: 'driverSurname', detail: chauffeur.nom },
    { n: 8, cle: 'idNumber', detail: camion.chauffeur_id_numero || '—' },
    { n: 9, cle: 'client', detail: client.raison_sociale },
    { n: 10, cle: 'transporter', detail: camion.transporteur || '—' },
    { n: 11, cle: 'expectedDepartureDate', detail: dateDepart },
    { n: 12, cle: 'destination', detail: commande.destination },
    { n: 13, cle: 'deliveryType', detail: typeLivraison(commande) },
    { n: 14, cle: 'grossMass', detail: masseValeur(chargement.poids_brut, locale) },
    { n: 15, cle: 'tareMass', detail: masseValeur(chargement.tare, locale) },
    { n: 16, cle: 'netMass', detail: masseValeur(chargement.poids_net, locale) },
    { n: 17, cle: 'operatorName', detail: operateur?.nom || evenementChargement?.valide_par || '—' },
  ]

  const html = `
    <div>
      <h1 style="font-size: 16pt; font-weight: bold; margin-bottom: 4mm; color: #1f2937;">${t('preAlert.title', { client: client.raison_sociale.toUpperCase() })}</h1>
      <p style="color: #6b7280; margin-bottom: 8mm;">${t('preAlert.subtitle', { reference: camion.reference, lot: lot.reference })}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
        <thead>
          <tr style="background: #111827; color: #fff;">
            <th style="width: 8%; padding: 8px; text-align: left; border: 1px solid #374151;">${t('preAlert.table.number')}</th>
            <th style="width: 32%; padding: 8px; text-align: left; border: 1px solid #374151;">${t('preAlert.table.information')}</th>
            <th style="width: 60%; padding: 8px; text-align: left; border: 1px solid #374151;">${t('preAlert.table.details')}</th>
          </tr>
        </thead>
        <tbody>
          ${lignes
            .map(
              (l, i) => `
            <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
              <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: 600;">${l.n}</td>
              <td style="padding: 8px; border: 1px solid #d1d5db; font-weight: 600;">${t(`preAlert.labels.${l.cle}`)}</td>
              <td style="padding: 8px; border: 1px solid #d1d5db;">${l.detail}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      <p style="margin-top: 8mm; font-size: 9pt; color: #6b7280;">
        ${t('preAlert.footer', { date: new Date().toLocaleString('fr-FR') })}
      </p>
    </div>
  `

  return htmlVersPdf(html, `Pre-alerte-${camion.reference}`)
}

/**
 * Télécharge un blob sous le nom indiqué.
 */
export function telechargerFichier(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  URL.revokeObjectURL(url)
}

function libelleTypeDocument(type: string): string {
  const labels: Record<string, string> = {
    BL: 'Bon de livraison',
    TICKET_PESEE: 'Ticket de pesée',
    COA: 'Certificat d’analyse',
    DECLARATION_EXPORT: 'Déclaration export',
    CMR: 'CMR',
    DECLARATION_IMPORT: 'Déclaration import',
    QUITTANCE: 'Quittance',
    RECU_PEAGE: 'Reçu péage',
    POD: 'Proof of delivery',
    TICKET_PESEE_MINE: 'Ticket de pesée mine',
    FACTURE_FINALE: 'Facture finale',
    PREUVE_SOLDE: 'Preuve de solde',
    AVIS_BANCAIRE: 'Avis bancaire',
  }
  return labels[type] || type
}

/**
 * Génère le PDF récapitulatif du bundle documentaire : pour chaque étape,
 * liste les documents requis, ceux présents et ceux manquants.
 */
export async function genererSyntheseBundlePdf(
  camion: Camion,
  etapes: EtapeBundle[],
  t: TFunction<'documents'>,
): Promise<Blob> {
  const totalManquants = etapes.filter((e) => e.requis.length > e.presents.length).length

  const html = `
    <div>
      <h1 style="font-size: 16pt; font-weight: bold; margin-bottom: 2mm;">${t('bundle.title')}</h1>
      <p style="color: #6b7280; margin-bottom: 6mm;">
        ${t('bundle.subtitle', { reference: camion.reference, plate: camion.plaque_tracteur })}<br/>
        ${t('bundle.generatedAt', { date: new Date().toLocaleString('fr-FR') })}
      </p>
      ${
        totalManquants === 0
          ? `<p style="color: #047857; font-weight: 600; margin-bottom: 6mm;">${t('bundle.allPresent')}</p>`
          : `<p style="color: #b91c1c; font-weight: 600; margin-bottom: 6mm;">${t('bundle.missing', { count: totalManquants })}</p>`
      }
      ${etapes
        .map((etape) => {
          const manquants = etape.requis.filter(
            (r) => !etape.presents.some((p) => p.type === r),
          )
          const lignes = etape.requis.length
            ? etape.requis
                .map((req) => {
                  const present = etape.presents.find((p) => p.type === req)
                  return `
                    <tr>
                      <td style="padding: 6px; border: 1px solid #d1d5db;">${libelleTypeDocument(req)}</td>
                      <td style="padding: 6px; border: 1px solid #d1d5db; color: ${present ? '#047857' : '#b91c1c'}; font-weight: 600;">
                        ${present ? t('bundle.present') : t('bundle.missingLabel')}
                      </td>
                      <td style="padding: 6px; border: 1px solid #d1d5db;">${present ? present.nom_fichier : '—'}</td>
                    </tr>
                  `
                })
                .join('')
            : `<tr><td colspan="3" style="padding: 6px; border: 1px solid #d1d5db; color: #6b7280;">${t('bundle.empty')}</td></tr>`
          return `
            <div style="margin-bottom: 6mm; page-break-inside: avoid;">
              <h2 style="font-size: 12pt; font-weight: 600; margin-bottom: 2mm; color: #111827;">
                ${t('bundle.step', { number: etape.numero, label: etape.libelle })}
              </h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 2mm;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 6px; border: 1px solid #d1d5db; text-align: left;">${t('bundle.requiredDocument')}</th>
                    <th style="padding: 6px; border: 1px solid #d1d5db; text-align: left;">${t('bundle.status')}</th>
                    <th style="padding: 6px; border: 1px solid #d1d5db; text-align: left;">${t('bundle.file')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${lignes}
                </tbody>
              </table>
              ${manquants.length > 0 ? `<p style="font-size: 8pt; color: #b91c1c;">${t('bundle.missingList', { documents: manquants.map(libelleTypeDocument).join(', ') })}</p>` : ''}
            </div>
          `
        })
        .join('')}
    </div>
  `

  return htmlVersPdf(html, `Synthese-${camion.reference}`)
}

/**
 * Télécharge un fichier depuis Supabase Storage via son chemin.
 * Fallback sur l'URL publique si le téléchargement signé échoue.
 */
async function telechargerDocument(doc: Document): Promise<Blob | null> {
  if (!doc.chemin_storage) {
    if (doc.url) {
      try {
        const response = await fetch(doc.url)
        if (response.ok) return await response.blob()
      } catch {
        return null
      }
    }
    return null
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_PREUVES)
    .download(doc.chemin_storage)

  if (error || !data) {
    if (doc.url) {
      try {
        const response = await fetch(doc.url)
        if (response.ok) return await response.blob()
      } catch {
        return null
      }
    }
    return null
  }

  return data
}

/**
 * Génère un ZIP contenant la synthèse PDF et tous les documents présents,
 * organisés par étape.
 */
export async function genererBundleZip(
  camion: Camion,
  referentiel: EtapeReferentiel[],
  documents: Document[],
  t: TFunction<'documents'>,
): Promise<Blob> {
  const etapes: EtapeBundle[] = referentiel.map((etape) => ({
    numero: etape.numero,
    libelle: etape.libelle,
    requis: etape.documents_requis,
    presents: documents.filter((d) => d.etape_numero === etape.numero),
  }))

  const zip = new JSZip()
  const dossier = zip.folder(nomFichierSafe(camion.reference))
  if (!dossier) throw new Error('Impossible de créer le dossier ZIP')

  const synthese = await genererSyntheseBundlePdf(camion, etapes, t)
  dossier.file('00_Synthese.pdf', synthese)

  for (const etape of etapes) {
    if (etape.presents.length === 0) continue
    const prefixe = `${String(etape.numero).padStart(2, '0')}_Etape${etape.numero}`
    const sousDossier = dossier.folder(prefixe)
    if (!sousDossier) continue

    for (const doc of etape.presents) {
      const blob = await telechargerDocument(doc)
      if (!blob) continue
      const ext = doc.nom_fichier.split('.').pop() ?? 'bin'
      const nom = `${nomFichierSafe(libelleTypeDocument(doc.type))}_${doc.id.slice(0, 8)}.${ext}`
      sousDossier.file(nom, blob)
    }
  }

  return zip.generateAsync({ type: 'blob' })
}
