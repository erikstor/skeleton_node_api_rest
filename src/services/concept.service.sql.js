/**
 *
 * @returns {string}
 */
export const createMassiveConcept = () => `
  WITH b_concepts AS (
    SELECT bc.id, bc.price, bc.name, bc.description, bc.round, bc.type
    FROM billing_concepts bc
    WHERE bc."deletedAt" IS NULL
      AND type = :type
      AND project = :project
      AND bc.name IN (:names)
  ),
       b_invoice_concept_accounting_account_project AS (
         SELECT bc.id concept, saapic.accounting_account_project
         FROM billing_invoice_concept bic
                JOIN b_concepts bc ON bc.id = bic.concept
                JOIN siigo_accounting_account_project_invoice_concept saapic ON bic.id = saapic.invoice_concept
         WHERE saapic."deletedAt" IS NULL
           AND bic."deletedAt" IS NULL
       ),
       build_object AS (
         SELECT bicaap.concept,
                JSON_AGG(
                  JSONB_BUILD_OBJECT('accounting_account_project',
                                     bicaap.accounting_account_project)) accounting_account
         FROM b_concepts AS bc
                JOIN b_invoice_concept_accounting_account_project bicaap ON bicaap.concept = bc.id
         GROUP BY bicaap.concept
       ),
       join_response AS (
         SELECT bc.id,
                bc.price,
                name,
                description,
                round,
                type,
                bo.accounting_account
         FROM b_concepts AS bc
                LEFT JOIN build_object bo ON bo.concept = bc.id
       )
  SELECT *
  FROM join_response
`


/**
 * consulta para traer los balances previos
 * de una propiedad para determinado tipo de concepto
 * desde la fecha anterior a la fecha dada
 * para el calculo de saldo en mora
 * @returns {string}
 */
export const conceptTypeFindDebt = () => `
  WITH b_all_invoices AS (
    -- SELECT DISTINCT ON (rs.id) bi.id,
    SELECT bi.id,
           bs.name       status,
           bs.description,
           bi.detail,
           rs.residential_units,
           rs.division_value,
           bi.date       payment_date,
           bi.real_state real_state
    FROM billing_invoice bi
           JOIN billing_status bs ON bi.status = bs.id
           JOIN real_state rs ON bi.real_state = rs.id
    WHERE bi."deletedAt" IS NULL
      AND bi."deletedAt" IS NULL
      AND bi.real_state IN (:realStateId)

      AND bi.date < :startOfCurrentMonth::TIMESTAMP WITH TIME ZONE
  ),
       -- NUEVO
       b_all_previous_concepts AS (
         SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                bc.price                                 price_without_round,
                bc.round,
                bai.id                                   invoice,
                bic.id                                   invoice_concept,
                bai.payment_date                         payment_date,
                bc.type,
                bic.concept                              concept,
                bc.name
         FROM b_all_invoices bai
                JOIN billing_invoice_concept bic ON bai.id = bic.invoice
                JOIN billing_concepts bc ON bic.concept = bc.id
         WHERE bic."deletedAt" IS NULL
           AND bc."deletedAt" IS NULL
           AND bc.type != 24
       ),
       -- NUEVO
       b_all_previous_payments AS (
         SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
         FROM billing_payment_invoice bpi
                JOIN b_all_previous_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                JOIN billing_payment bp ON bp.id = bpi.payment
              -- todo quitar este quemado de aca
              -- WHERE bp.status IN  (1, 10)
         WHERE bp.status IN (:status)
           AND bp."deletedAt" IS NULL
           AND bpi."deletedAt" IS NULL
         GROUP BY bpi.invoice_concept
       ),


       b_fee_concepts AS (
         SELECT *
         FROM b_all_previous_concepts bac
         WHERE bac.type = :type
       ),
       b_fee_payment AS (
         SELECT bap.*
         FROM b_all_previous_payments bap
         WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_fee_concepts)
       ),
       -- se busca el descuento del mes actual del concepto de administración
       b_all_fee_discount AS (
         SELECT DISTINCT ON (discount.concept) discount.*
         FROM (
                SELECT bd.id,
                       bd.amount,
                       bd.percentage,
                       bd.deadline,
                       bcfc.invoice_concept,
                       bcfc.invoice,
                       bcfc.concept
                FROM billing_discount bd
                       JOIN b_fee_concepts bcfc ON bd.concept = bcfc.concept
                       JOIN b_fee_payment bcfp ON bcfp.invoice_concept = bcfc.invoice_concept
                WHERE bd."deletedAt" IS NULL
                  -- pendiente de esta condición porque podría no traer el descuento cuando se paga el mismo día
                  AND bcfp.date <= bd.deadline
                ORDER BY bd.deadline
              ) discount
         -- LIMIT 1
       ),
       b_fee_concept_filte_1 AS (
         SELECT DISTINCT ON (bfc.invoice) bfc.invoice
         FROM b_fee_concepts bfc
                JOIN b_fee_payment bfp ON bfc.invoice_concept = bfp.invoice_concept
                LEFT JOIN b_all_fee_discount bacfd ON bfc.invoice_concept = bacfd.invoice_concept
              -- de este filtro deben salir los que no tienen descuento
         WHERE COALESCE(bfp.amount, 0)
           < (CASE
                WHEN bacfd.percentage IS NOT NULL THEN
                  round_wihom(
                      bfc.price - ((bfc.price_without_round * bacfd.percentage) / 100),
                      bfc.round::DECIMAL)
                WHEN bacfd.amount IS NOT NULL THEN
                  round_wihom(bfc.price_without_round,
                              bfc.round::DECIMAL)
                ELSE bfc.price
             END
                 )
           AND price > 0
       ),
       b_interest_concepts AS (
         SELECT *
         FROM b_all_previous_concepts bapc
         WHERE bapc.type = 27
         -- AND bac.price > 0
       ),
       b_interest_payment AS (
         SELECT bap.*
         FROM b_all_previous_payments bap
         WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_interest_concepts)
       ),
       -- buscar cuales de las facturas tiene conceptos de intereses sin pagar
       b_interest_concept_filte_2 AS (
         SELECT COALESCE(bfi.amount, 0) payment, bfc.invoice_concept, bfc.price, bfc.invoice
         FROM b_interest_concepts bfc
                LEFT JOIN b_interest_payment bfi ON bfc.invoice_concept = bfi.invoice_concept
         WHERE COALESCE(bfi.amount, 0) < bfc.price
           AND bfc.price > 0
       ),
       b_join_filter AS (
         SELECT invoice
         FROM b_fee_concept_filte_1
         UNION
         SELECT invoice
         FROM b_interest_concept_filte_2
       ),
       -- NUEVO
       b_join_current_and_previous_concepts AS (
         SELECT *
         FROM b_all_previous_concepts
       ),
       b_join_current_and_previous_payments AS (
         SELECT *
         FROM b_all_previous_payments
       ),
       b_fee_concepts_with_discount AS (
         SELECT (CASE
                   WHEN bd.percentage IS NOT NULL
                     THEN round_wihom(b.price - ((b.price_without_round * bd.percentage) / 100),
                                      b.round::DECIMAL)
                   WHEN bd.amount IS NOT NULL
                     THEN round_wihom(b.price_without_round - bd.amount,
                                      b.round::DECIMAL)
           END) with_discount,
                b.invoice_concept
         FROM b_all_fee_discount bd
                JOIN b_fee_concepts b ON bd.invoice_concept = b.invoice_concept
                LEFT JOIN b_fee_payment bap ON bap.invoice_concept = b.invoice_concept
         WHERE b.invoice NOT IN (SELECT invoice FROM b_join_filter)
       ),
       b_real_state_debt AS (
         SELECT bac.name,
                (CASE
                   WHEN
                       SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0)) >= 0
                     THEN SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0))
                   ELSE 0
                  END
                  )         debt,
                bac.type,
                bai.real_state,
                bac.concept concept_id,
                bac.invoice_concept,
                bac.round,
                bap.date

         FROM b_join_current_and_previous_concepts bac
                JOIN b_all_invoices bai ON bai.id = bac.invoice
                LEFT JOIN b_fee_concepts_with_discount bfcwd ON bac.invoice_concept = bfcwd.invoice_concept
                LEFT JOIN b_join_current_and_previous_payments bap ON bap.invoice_concept = bac.invoice_concept
         GROUP BY bac.name, bac.type, bai.real_state, bac.concept, bac.invoice_concept, bac.round, bap.date
       )
  SELECT sum(debt) debt
  FROM b_real_state_debt brsd
  WHERE brsd.type = :type;
`

/**
 * concept_relation representa en el front el id a eliminar
 * account_relation representa el id a asociar con el nombre
 */
export const findConceptsAndAccount = () => `

  SELECT JSON_AGG(JSONB_BUILD_OBJECT('concept_relation', saapic.id, 'account_relation', saap.id, 'type', bt.name)) account
  FROM billing_invoice_concept bic
         JOIN siigo_accounting_account_project_invoice_concept saapic ON saapic.invoice_concept = bic.id
         JOIN siigo_accounting_account_project saap ON saapic.accounting_account_project = saap.id
         JOIN siigo_accounting_account saa ON saa.id = saap.accounting_account
        join public.billing_type bt ON saa.movement = bt.id
  WHERE bic.concept = :concept
    AND bic."deletedAt" IS NULL
    AND saapic."deletedAt" IS NULL
    AND saap."deletedAt" IS NULL
    AND saa."deletedAt" IS NULL

`

export const findConceptNameByInvoiceConceptId = () => `
  SELECT c.name
  FROM billing_concepts c
         JOIN billing_invoice_concept bic ON c.id = bic.concept
  WHERE bic.id = :invoice_concept
`
