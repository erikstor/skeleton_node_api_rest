/**
 *
 * @returns {string}
 */
export const breakdownPreviousBalanceByRealStateV0 = () => `
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
         WHERE bac.type = 20
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
  SELECT *
  FROM b_real_state_debt
`;


/**
 * @deprecated
 * @returns {string}
 */
export const queryVerifyIfSendCanceledNotification = () => (`
  WITH getInvoice AS (
    SELECT bi.id AS invoice
    FROM billing_payment bp
           INNER JOIN billing_payment_invoice bpi ON bp.id = bpi.payment
           INNER JOIN billing_invoice_concept bic ON bpi.invoice_concept = bic.id
           INNER JOIN billing_invoice bi ON bi.id = bic.invoice
    WHERE bp.id = :payment
      AND bp."deletedAt" IS NULL
      AND bpi."deletedAt" IS NULL
      AND bic."deletedAt" IS NULL
      AND bi."deletedAt" IS NULL
    GROUP BY bi.id, bp.real_state
  ),
       getPayments AS (
         SELECT p.id, p.amount, p.real_state, bi.id invoice
         FROM billing_invoice bi
                INNER JOIN billing_invoice_concept b ON bi.id = b.invoice
                INNER JOIN billing_payment_invoice i ON b.id = i.invoice_concept
                INNER JOIN billing_payment p ON p.id = i.payment
         WHERE bi.id = (SELECT invoice FROM getInvoice)
           AND bi."deletedAt" IS NULL
           AND b."deletedAt" IS NULL
           AND i."deletedAt" IS NULL
           AND p."deletedAt" IS NULL
           AND p.status IN (:status)
         GROUP BY p.id, bi.id
         ORDER BY p.id
       )
  SELECT SUM(amount), real_state, invoice
  FROM getPayments
  GROUP BY real_state, invoice
`)

/**
 *
 * @returns {string}
 */
export const getPositiveBalanceByRealState = () => (`
  WITH b_payment AS (
    SELECT SUM(bp.amount) amount, bp.id, bp.real_state
    FROM billing_payment bp
    WHERE bp."deletedAt" IS NULL
      AND bp.status IN (:status)
      AND bp.real_state IN (:realState)
      AND bp.project = :project
    GROUP BY bp.id
  ),
       b_payment_invoice AS (
         SELECT SUM(bpi.amount) as amount, bp.id as payment
         FROM b_payment bp
                JOIN billing_payment_invoice bpi ON bp.id = bpi.payment
                join billing_invoice_concept bic ON bpi.invoice_concept = bic.id
                join billing_invoice bi on bi.id = bic.invoice
         WHERE bpi."deletedAt" IS NULL
           and bi."deletedAt" is null
         GROUP BY bp.id
       )

  SELECT CASE
           WHEN SUM(COALESCE(bpi.amount, 0) - bp.amount) < 0
             THEN SUM(COALESCE(bpi.amount, 0) - bp.amount)
           ELSE 0
           END
           credit_balance,
         bp.real_state
  FROM b_payment bp
         LEFT JOIN b_payment_invoice bpi ON bp.id = bpi.payment
  GROUP BY bp.real_state
  -- HAVING SUM(bpi.amount - bp.amount) < 0
`)

/**
 *
 * @returns {string}
*/

export const reportCartEdad = () => (`
  WITH b_1_30 AS (
    WITH b_all_invoices AS (
      SELECT bi.id,
             bs.name       status,
             bs.description,
             bi.detail,
             rs.id         real_state_id,
             rs.residential_units,
             rs.division_value,
             bi.date       payment_date,
             bi.real_state real_state
      FROM billing_invoice bi
             JOIN billing_status bs ON bi.status = bs.id
             JOIN real_state rs ON bi.real_state = rs.id
      WHERE bi."deletedAt" IS NULL
        AND bi.project = :project
        AND rs.id IN (:real_states)
        AND bi.date BETWEEN :b_1_30_start AND :b_1_30_end
    ),
         b_all_previous_concepts AS (
           SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                  bc.price                                 price_without_round,
                  bc.round,
                  bai.id                                   invoice,
                  bic.id                                   invoice_concept,
                  bai.payment_date                         payment_date,
                  (CASE
                     WHEN bc.type = 27 THEN 24
                     ELSE bc.type END)                     "type",
                  bic.concept                              concept
           FROM billing_invoice bi
                  JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                  JOIN billing_concepts bc ON bic.concept = bc.id
                  JOIN b_all_invoices bai ON bai.real_state = bi.real_state
           WHERE bic."deletedAt" IS NULL
             AND bc."deletedAt" IS NULL
             AND bi.date < DATE_TRUNC('month', bai.payment_date)
             AND bc.type != 24
         ),
         b_all_previous_payments AS (
           SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
           FROM billing_payment_invoice bpi
                  JOIN b_all_previous_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                  JOIN billing_payment bp ON bp.id = bpi.payment
           WHERE bp.status IN (1, 10)
             AND bp."deletedAt" IS NULL
             AND bpi."deletedAt" IS NULL
           GROUP BY bpi.invoice_concept
         ),
         b_all_concepts AS (
           SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                  bc.price                                 price_without_round,
                  bc.round,
                  bi.id                                    invoice,
                  bic.id                                   invoice_concept,
                  bi.payment_date,
                  bc.type                                  "type",
                  bic.concept                              concept
           FROM b_all_invoices bi
                  JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                  JOIN billing_concepts bc ON bic.concept = bc.id
           WHERE bic."deletedAt" IS NULL
             AND bc."deletedAt" IS NULL
         ),
         b_all_payments AS (
           SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
           FROM billing_payment_invoice bpi
                  JOIN b_all_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                  JOIN billing_payment bp ON bp.id = bpi.payment
           WHERE bp.status IN (1, 10)
             AND bp."deletedAt" IS NULL
             AND bpi."deletedAt" IS NULL
           GROUP BY bpi.invoice_concept
         ),
         b_current_fee_concepts AS (
           SELECT *
           FROM b_all_concepts bac
           WHERE bac.type = 20
         ),
         b_current_fee_payment AS (
           SELECT bap.*
           FROM b_all_payments bap
           WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_current_fee_concepts)
         ),
         b_fee_concepts AS (
           SELECT *
           FROM b_current_fee_concepts bcfc
           UNION
           SELECT *
           FROM b_all_previous_concepts bac
           WHERE bac.type = 20
         ),
         b_fee_payment AS (
           SELECT *
           FROM b_current_fee_payment
           UNION
           SELECT bap.*
           FROM b_all_previous_payments bap
           WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_fee_concepts)
         ),
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
                    AND bcfp.date <= bd.deadline
                  ORDER BY bd.deadline
                ) discount
         ),
         -- filtro para validar que se puede aplicar descuento a un concepto
         -- por fecha de pago y fecha del descuento
         b_fee_concept_filte_1 AS (
           SELECT DISTINCT ON (bfc.invoice) bfc.invoice
           FROM b_fee_concepts bfc
                  JOIN b_fee_payment bfp ON bfc.invoice_concept = bfp.invoice_concept
                  LEFT JOIN b_all_fee_discount bacfd ON bfc.invoice_concept = bacfd.invoice_concept
                -- de este filtro deberian salir los que no tienen descuento
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
           FROM b_all_concepts bac
           WHERE bac.type = 24
           UNION
           SELECT *
           FROM b_all_previous_concepts bapc
           WHERE bapc.type = 24
         ),
         b_interest_payment AS (
           SELECT *
           FROM (
                  SELECT *
                  FROM b_all_payments
                  UNION
                  SELECT *
                  FROM b_all_previous_payments
                ) AS bap
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
         b_join_current_and_previous_concepts AS (
           SELECT *
           FROM b_all_previous_concepts
           UNION
           SELECT *
           FROM b_all_concepts
         ),
         b_join_current_and_previous_payments AS (
           SELECT *
           FROM b_all_payments
           UNION ALL
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
           SELECT bac.invoice,
                  (CASE
                     WHEN
                         SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0)) >= 0
                       THEN SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0))
                     ELSE 0
                    END
                    )                                           debt,
                  SUM(COALESCE(bfcwd.with_discount, bac.price)) price

           FROM b_join_current_and_previous_concepts bac
                  JOIN billing_type bt ON bt.id = bac.type
                  LEFT JOIN b_fee_concepts_with_discount bfcwd ON bac.invoice_concept = bfcwd.invoice_concept
                  LEFT JOIN b_join_current_and_previous_payments bap ON bap.invoice_concept = bac.invoice_concept
           GROUP BY bac.invoice
         ),
         b_sum_result AS (
           SELECT bai.id                                                             invoice,
                  bai.real_state_id,
                  bai.division_value,
                  bai.residential_units,
                  bai.detail,
                  bai.description,
                  bai.status                                                         "statusName",
                  brsd.price,
                  brsd.debt,
                  bai.payment_date                                                   "create",
                  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day' deadline
           FROM b_real_state_debt brsd
                  JOIN b_all_invoices bai ON bai.id = brsd.invoice
                -- here the order
           ORDER BY division_value, residential_units
         ),
         b_count_results AS (
           SELECT invoice,
                  "create",
                  real_state_id,
                  concat(division_value, ' - ', residential_units) codigo,
                  SUM(debt)                                        debt
           FROM b_sum_result
           GROUP BY real_state_id, division_value, residential_units, invoice, "create"
           ORDER BY division_value, residential_units
         )
    SELECT bc.*
    FROM b_count_results bc
  ),
       b_30_60 AS (
         WITH b_all_invoices AS (
           SELECT bi.id,
                  bs.name       status,
                  bs.description,
                  bi.detail,
                  rs.id         real_state_id,
                  rs.residential_units,
                  rs.division_value,
                  bi.date       payment_date,
                  bi.real_state real_state
           FROM billing_invoice bi
                  JOIN billing_status bs ON bi.status = bs.id
                  JOIN real_state rs ON bi.real_state = rs.id
           WHERE bi."deletedAt" IS NULL
             AND bi.project = :project
             AND rs.id IN (:real_states)
             AND bi.date BETWEEN :b_30_60_start AND :b_30_60_end
         ),
              b_all_previous_concepts AS (
                SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                       bc.price                                 price_without_round,
                       bc.round,
                       bai.id                                   invoice,
                       bic.id                                   invoice_concept,
                       bai.payment_date                         payment_date,
                       (CASE
                          WHEN bc.type = 27 THEN 24
                          ELSE bc.type END)                     "type",
                       bic.concept                              concept
                FROM billing_invoice bi
                       JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                       JOIN billing_concepts bc ON bic.concept = bc.id
                       JOIN b_all_invoices bai ON bai.real_state = bi.real_state
                WHERE bic."deletedAt" IS NULL
                  AND bc."deletedAt" IS NULL
                  AND bi.date < DATE_TRUNC('month', bai.payment_date)
                  AND bc.type != 24
              ),
              b_all_previous_payments AS (
                SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
                FROM billing_payment_invoice bpi
                       JOIN b_all_previous_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                       JOIN billing_payment bp ON bp.id = bpi.payment
                WHERE bp.status IN (1, 10)
                  AND bp."deletedAt" IS NULL
                  AND bpi."deletedAt" IS NULL
                GROUP BY bpi.invoice_concept
              ),
              b_all_concepts AS (
                SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                       bc.price                                 price_without_round,
                       bc.round,
                       bi.id                                    invoice,
                       bic.id                                   invoice_concept,
                       bi.payment_date,
                       bc.type                                  "type",
                       bic.concept                              concept
                FROM b_all_invoices bi
                       JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                       JOIN billing_concepts bc ON bic.concept = bc.id
                WHERE bic."deletedAt" IS NULL
                  AND bc."deletedAt" IS NULL
              ),
              b_all_payments AS (
                SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
                FROM billing_payment_invoice bpi
                       JOIN b_all_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                       JOIN billing_payment bp ON bp.id = bpi.payment
                WHERE bp.status IN (1, 10)
                  AND bp."deletedAt" IS NULL
                  AND bpi."deletedAt" IS NULL
                GROUP BY bpi.invoice_concept
              ),
              b_current_fee_concepts AS (
                SELECT *
                FROM b_all_concepts bac
                WHERE bac.type = 20
              ),
              b_current_fee_payment AS (
                SELECT bap.*
                FROM b_all_payments bap
                WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_current_fee_concepts)
              ),
              b_fee_concepts AS (
                SELECT *
                FROM b_current_fee_concepts bcfc
                UNION
                SELECT *
                FROM b_all_previous_concepts bac
                WHERE bac.type = 20
              ),
              b_fee_payment AS (
                SELECT *
                FROM b_current_fee_payment
                UNION
                SELECT bap.*
                FROM b_all_previous_payments bap
                WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_fee_concepts)
              ),
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
                         AND bcfp.date <= bd.deadline
                       ORDER BY bd.deadline
                     ) discount
              ),
              -- filtro para validar que se puede aplicar descuento a un concepto
              -- por fecha de pago y fecha del descuento
              b_fee_concept_filte_1 AS (
                SELECT DISTINCT ON (bfc.invoice) bfc.invoice
                FROM b_fee_concepts bfc
                       JOIN b_fee_payment bfp ON bfc.invoice_concept = bfp.invoice_concept
                       LEFT JOIN b_all_fee_discount bacfd ON bfc.invoice_concept = bacfd.invoice_concept
                     -- de este filtro deberian salir los que no tienen descuento
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
                FROM b_all_concepts bac
                WHERE bac.type = 24
                UNION
                SELECT *
                FROM b_all_previous_concepts bapc
                WHERE bapc.type = 24
              ),
              b_interest_payment AS (
                SELECT *
                FROM (
                       SELECT *
                       FROM b_all_payments
                       UNION
                       SELECT *
                       FROM b_all_previous_payments
                     ) AS bap
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
              b_join_current_and_previous_concepts AS (
                SELECT *
                FROM b_all_previous_concepts
                UNION
                SELECT *
                FROM b_all_concepts
              ),
              b_join_current_and_previous_payments AS (
                SELECT *
                FROM b_all_payments
                UNION ALL
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
                SELECT bac.invoice,
                       (CASE
                          WHEN
                              SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0)) >= 0
                            THEN SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0))
                          ELSE 0
                         END
                         )                                           debt,
                       SUM(COALESCE(bfcwd.with_discount, bac.price)) price

                FROM b_join_current_and_previous_concepts bac
                       JOIN billing_type bt ON bt.id = bac.type
                       LEFT JOIN b_fee_concepts_with_discount bfcwd ON bac.invoice_concept = bfcwd.invoice_concept
                       LEFT JOIN b_join_current_and_previous_payments bap
                                 ON bap.invoice_concept = bac.invoice_concept
                GROUP BY bac.invoice
              ),
              b_sum_result AS (
                SELECT bai.id                                                             invoice,
                       bai.real_state_id,
                       bai.division_value,
                       bai.residential_units,
                       bai.detail,
                       bai.description,
                       bai.status                                                         "statusName",
                       brsd.price,
                       brsd.debt,
                       bai.payment_date                                                   "create",
                       DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day' deadline
                FROM b_real_state_debt brsd
                       JOIN b_all_invoices bai ON bai.id = brsd.invoice
                     -- here the order
                ORDER BY division_value, residential_units
              ),
              b_count_results AS (
                SELECT invoice,
                       real_state_id,
                       concat(division_value, ' - ', residential_units) codigo,
                       SUM(debt)                                        debt
                FROM b_sum_result
                GROUP BY real_state_id, division_value, residential_units, invoice
                ORDER BY division_value, residential_units
              )
         SELECT bc.*
         FROM b_count_results bc
       ),
       b_60_90 AS (
         WITH b_all_invoices AS (
           SELECT bi.id,
                  bs.name       status,
                  bs.description,
                  bi.detail,
                  rs.id         real_state_id,
                  rs.residential_units,
                  rs.division_value,
                  bi.date       payment_date,
                  bi.real_state real_state
           FROM billing_invoice bi
                  JOIN billing_status bs ON bi.status = bs.id
                  JOIN real_state rs ON bi.real_state = rs.id
           WHERE bi."deletedAt" IS NULL
             AND bi.project = :project
             AND rs.id IN (:real_states)
             AND bi.date BETWEEN :b_60_90_start AND :b_60_90_end
         ),
              b_all_previous_concepts AS (
                SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                       bc.price                                 price_without_round,
                       bc.round,
                       bai.id                                   invoice,
                       bic.id                                   invoice_concept,
                       bai.payment_date                         payment_date,
                       (CASE
                          WHEN bc.type = 27 THEN 24
                          ELSE bc.type END)                     "type",
                       bic.concept                              concept
                FROM billing_invoice bi
                       JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                       JOIN billing_concepts bc ON bic.concept = bc.id
                       JOIN b_all_invoices bai ON bai.real_state = bi.real_state
                WHERE bic."deletedAt" IS NULL
                  AND bc."deletedAt" IS NULL
                  AND bi.date < DATE_TRUNC('month', bai.payment_date)
                  AND bc.type != 24
              ),
              b_all_previous_payments AS (
                SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
                FROM billing_payment_invoice bpi
                       JOIN b_all_previous_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                       JOIN billing_payment bp ON bp.id = bpi.payment
                WHERE bp.status IN (1, 10)
                  AND bp."deletedAt" IS NULL
                  AND bpi."deletedAt" IS NULL
                GROUP BY bpi.invoice_concept
              ),
              b_all_concepts AS (
                SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                       bc.price                                 price_without_round,
                       bc.round,
                       bi.id                                    invoice,
                       bic.id                                   invoice_concept,
                       bi.payment_date,
                       bc.type                                  "type",
                       bic.concept                              concept
                FROM b_all_invoices bi
                       JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                       JOIN billing_concepts bc ON bic.concept = bc.id
                WHERE bic."deletedAt" IS NULL
                  AND bc."deletedAt" IS NULL
              ),
              b_all_payments AS (
                SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
                FROM billing_payment_invoice bpi
                       JOIN b_all_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                       JOIN billing_payment bp ON bp.id = bpi.payment
                WHERE bp.status IN (1, 10)
                  AND bp."deletedAt" IS NULL
                  AND bpi."deletedAt" IS NULL
                GROUP BY bpi.invoice_concept
              ),
              b_current_fee_concepts AS (
                SELECT *
                FROM b_all_concepts bac
                WHERE bac.type = 20
              ),
              b_current_fee_payment AS (
                SELECT bap.*
                FROM b_all_payments bap
                WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_current_fee_concepts)
              ),
              b_fee_concepts AS (
                SELECT *
                FROM b_current_fee_concepts bcfc
                UNION
                SELECT *
                FROM b_all_previous_concepts bac
                WHERE bac.type = 20
              ),
              b_fee_payment AS (
                SELECT *
                FROM b_current_fee_payment
                UNION
                SELECT bap.*
                FROM b_all_previous_payments bap
                WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_fee_concepts)
              ),
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
                         AND bcfp.date <= bd.deadline
                       ORDER BY bd.deadline
                     ) discount
              ),
              -- filtro para validar que se puede aplicar descuento a un concepto
              -- por fecha de pago y fecha del descuento
              b_fee_concept_filte_1 AS (
                SELECT DISTINCT ON (bfc.invoice) bfc.invoice
                FROM b_fee_concepts bfc
                       JOIN b_fee_payment bfp ON bfc.invoice_concept = bfp.invoice_concept
                       LEFT JOIN b_all_fee_discount bacfd ON bfc.invoice_concept = bacfd.invoice_concept
                     -- de este filtro deberian salir los que no tienen descuento
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
                FROM b_all_concepts bac
                WHERE bac.type = 24
                UNION
                SELECT *
                FROM b_all_previous_concepts bapc
                WHERE bapc.type = 24
              ),
              b_interest_payment AS (
                SELECT *
                FROM (
                       SELECT *
                       FROM b_all_payments
                       UNION
                       SELECT *
                       FROM b_all_previous_payments
                     ) AS bap
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
              b_join_current_and_previous_concepts AS (
                SELECT *
                FROM b_all_previous_concepts
                UNION
                SELECT *
                FROM b_all_concepts
              ),
              b_join_current_and_previous_payments AS (
                SELECT *
                FROM b_all_payments
                UNION ALL
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
                SELECT bac.invoice,
                       (CASE
                          WHEN
                              SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0)) >= 0
                            THEN SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0))
                          ELSE 0
                         END
                         )                                           debt,
                       SUM(COALESCE(bfcwd.with_discount, bac.price)) price

                FROM b_join_current_and_previous_concepts bac
                       JOIN billing_type bt ON bt.id = bac.type
                       LEFT JOIN b_fee_concepts_with_discount bfcwd ON bac.invoice_concept = bfcwd.invoice_concept
                       LEFT JOIN b_join_current_and_previous_payments bap
                                 ON bap.invoice_concept = bac.invoice_concept
                GROUP BY bac.invoice
              ),
              b_sum_result AS (
                SELECT bai.id                                                             invoice,
                       bai.real_state_id,
                       bai.division_value,
                       bai.residential_units,
                       bai.detail,
                       bai.description,
                       bai.status                                                         "statusName",
                       brsd.price,
                       brsd.debt,
                       bai.payment_date                                                   "create",
                       DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day' deadline
                FROM b_real_state_debt brsd
                       JOIN b_all_invoices bai ON bai.id = brsd.invoice
                     -- here the order
                ORDER BY division_value, residential_units
              ),
              b_count_results AS (
                SELECT invoice,
                       real_state_id,
                       concat(division_value, ' - ', residential_units) codigo,
                       SUM(debt)                                        debt
                FROM b_sum_result
                GROUP BY real_state_id, division_value, residential_units, invoice
                ORDER BY division_value, residential_units
              )
         SELECT bc.*
         FROM b_count_results bc
       ),
       b_join_all AS (
         select b1.invoice       as b_invoice_1_30,
                b1.real_state_id as b_real_state_id_1_30,
                b1.debt          as b_debt_1_30,
                b1.codigo        as b_codigo_1_30,

                b3.invoice       as b_invoice_30_60,
                b3.real_state_id as b_real_state_id_30_60,
                b3.debt          as b_debt_30_60,
                b3.codigo        as b_codigo_30_60,

                b6.invoice       as b_invoice_60_90,
                b6.real_state_id as b_real_state_id_60_90,
                b6.debt          as b_debt_60_90,
                b6.codigo        as b_codigo_60_90
         from b_1_30 b1
                FULL OUTER JOIN b_30_60 b3 ON b1.real_state_id = b3.real_state_id
                FULL OUTER JOIN b_60_90 b6 ON b1.real_state_id = b6.real_state_id
       ),
       real_state_owner AS (
         SELECT U.name, rs2.id
         FROM real_state rs2
                JOIN real_state_project_user rspu ON rs2.id = rspu.real_state
                JOIN "Project_User" PU on rspu.project_user = PU.id
                JOIN "User" U ON PU.id_user = U.id
         WHERE U."deletedAt" IS NULL
           AND PU."deletedAt" IS NULL
           AND rspu."deletedAt" IS NULL
           AND rs2."deletedAt" IS NULL
           AND PU.type_user in ('arrendatario', 'propietario')
       ),
       last_invoice AS (
         SELECT DISTINCT ON (real_state) id,
                                         date,
                                         real_state
         FROM billing_invoice bi
         WHERE real_state in (:real_states)
           AND "deletedAt" IS NULL
         ORDER BY real_state, date DESC
       ),
       make_result_first_step AS (
         SELECT (
                  CASE
                    WHEN bja.b_invoice_1_30 IS NOT NULL
                      THEN b_invoice_1_30
                    WHEN bja.b_invoice_1_30 IS NULL AND bja.b_invoice_30_60 IS NOT NULL
                      THEN bja.b_invoice_30_60
                    WHEN bja.b_invoice_1_30 IS NULL AND bja.b_invoice_30_60 IS NULL
                      THEN bja.b_invoice_60_90
                    WHEN bja.b_invoice_1_30 IS NULL AND bja.b_invoice_30_60 IS NULL AND bja.b_invoice_60_90 IS NULL
                      THEN 'Sin facturacion'
                    END
                  )                                                                                          factura,
                (
                  CASE
                    WHEN bja.b_codigo_1_30 IS NOT NULL
                      THEN b_codigo_1_30
                    WHEN bja.b_codigo_1_30 IS NULL AND bja.b_codigo_30_60 IS NOT NULL
                      THEN bja.b_codigo_30_60
                    WHEN bja.b_codigo_1_30 IS NULL AND bja.b_codigo_30_60 IS NULL
                      THEN bja.b_codigo_60_90
                    WHEN bja.b_codigo_1_30 IS NULL AND bja.b_codigo_30_60 IS NULL AND bja.b_codigo_60_90 IS NULL
                      THEN ''
                    END
                  )                                                                                          codigo,
                (
                  CASE
                    WHEN bja.b_real_state_id_1_30 IS NOT NULL
                      THEN b_real_state_id_1_30
                    WHEN bja.b_real_state_id_1_30 IS NULL AND bja.b_real_state_id_30_60 IS NOT NULL
                      THEN bja.b_real_state_id_30_60
                    WHEN bja.b_real_state_id_1_30 IS NULL AND bja.b_real_state_id_30_60 IS NULL
                      THEN bja.b_real_state_id_60_90
                    WHEN bja.b_real_state_id_1_30 IS NULL AND bja.b_real_state_id_30_60 IS NULL AND
                         bja.b_real_state_id_60_90 IS NULL
                      THEN null
                    END
                  )                                                                                          real_state,
                coalesce(bja.b_debt_1_30::varchar, 'Sin facturacion')                                        b_debt_1_30,
                coalesce(bja.b_debt_30_60::varchar, 'Sin facturacion')                                       b_debt_30_60,
                coalesce(bja.b_debt_60_90::varchar, 'Sin facturacion')                                       b_debt_60_90,
                COALESCE(bja.b_debt_1_30, 0) + COALESCE(bja.b_debt_30_60, 0) + COALESCE(bja.b_debt_60_90, 0) total
         FROM b_join_all bja
       ),
       make_result AS (
         SELECT DISTINCT ON (mrfs.real_state) mrfs.codigo,
                                              rso.name          as                          nombre,
                                              coalesce(li.date::varchar, 'Sin facturacion') fecha,
                                              coalesce(li.id::varchar, 'Sin facturacion')   factura,
                                              mrfs.b_debt_1_30  AS                          "1_30",
                                              mrfs.b_debt_30_60 AS                          "31_60",
                                              mrfs.b_debt_60_90 AS                          "90_mas",
                                              mrfs.total
         FROM make_result_first_step mrfs
                JOIN real_state_owner rso ON rso.id = mrfs.real_state
                JOIN last_invoice li ON li.real_state = mrfs.real_state
         GROUP BY mrfs.real_state,
                  mrfs.codigo,
                  rso.name,
                  li.date,
                  li.id,
                  mrfs.b_debt_1_30,
                  mrfs.b_debt_30_60,
                  mrfs.b_debt_60_90,
                  mrfs.total
       ),
       counter AS (
         SELECT count(*)
         FROM make_result
       )
  SELECT *
  FROM make_result,
       counter
  ORDER BY "1_30",
           "31_60",
           "90_mas"
`)


export const reportCardConcept = () => (`
  WITH first_invoice AS (
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
      AND bi.real_state = :real_state
      -- ESP4673#__#18a2
      --AND date > DATE_TRUNC('month', NOW())
      AND bi."date" BETWEEN :first_begin AND :first_end
    ORDER BY bi.date DESC
    LIMIT 1
  ),
       second_invoice AS (
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
           AND bi.real_state = :real_state
           -- ESP4673#__#18a2
           --AND date > DATE_TRUNC('month', NOW())
           AND bi."date" BETWEEN :second_begin AND :second_end
         ORDER BY bi.date DESC
         LIMIT 1
       ),
       third_invoice AS (
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
           AND bi.real_state = :real_state
           -- ESP4673#__#18a2
           --AND date > DATE_TRUNC('month', NOW())
           AND bi."date" BETWEEN :third_begin AND :third_end
         ORDER BY bi.date DESC
         LIMIT 1
       ),
       four_invoice AS (
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
           AND bi.real_state = :real_state
           -- ESP4673#__#18a2
           --AND date > DATE_TRUNC('month', NOW())
           AND bi."date" BETWEEN :fourth_begin AND :fourth_end
         ORDER BY bi.date DESC
         LIMIT 1
       ),
       b_all_invoices AS (SELECT *
                          FROM first_invoice
                          UNION
                          SELECT *
                          FROM second_invoice
                          UNION
                          SELECT *
                          FROM third_invoice
                          UNION
                          SELECT *
                          FROM four_invoice
       ),
       -- NUEVO
       b_all_previous_concepts AS (
         SELECT round_wihom(bc.price, bc.round::DECIMAL)          price,
                bc.price                                          price_without_round,
                bc.round,
                bai.id                                            invoice,
                bic.id                                            invoice_concept,
                bai.payment_date                                  payment_date,
                -- TODO QUITAR ESTE QUEMADO DE ACA
                (CASE WHEN bc.type = 27 THEN 24 ELSE bc.type END) "type",
                bic.concept                                       concept,
                bai.residential_units,
                bai.division_value
         FROM billing_invoice bi
                JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                JOIN billing_concepts bc ON bic.concept = bc.id
                JOIN b_all_invoices bai ON bai.real_state = bi.real_state
         WHERE bic."deletedAt" IS NULL
           AND bc."deletedAt" IS NULL
           AND bi.date < DATE_TRUNC('month', bai.payment_date)

           AND bc.type != 24
         -- AND bi.real_state = '3b6bbe8a-0709-ce89-5bbe-d54ec0f92ee8'
       ),
       -- NUEVO
       b_all_previous_payments AS (
         SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
         FROM billing_payment_invoice bpi
                JOIN b_all_previous_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                JOIN billing_payment bp ON bp.id = bpi.payment
              -- todo quitar este quemado de aca
         WHERE bp.status IN (1, 10)
           AND bp."deletedAt" IS NULL
           AND bpi."deletedAt" IS NULL
         GROUP BY bpi.invoice_concept
       ),
       b_all_concepts AS (
         SELECT round_wihom(bc.price, bc.round::DECIMAL) price,
                bc.price                                 price_without_round,
                bc.round,
                bi.id                                    invoice,
                bic.id                                   invoice_concept,
                bi.payment_date,
                bc.type                                  "type",
                bic.concept                              concept,
                bi.residential_units,
                bi.division_value
         FROM b_all_invoices bi
                JOIN billing_invoice_concept bic ON bi.id = bic.invoice
                JOIN billing_concepts bc ON bic.concept = bc.id
         WHERE bic."deletedAt" IS NULL
           AND bc."deletedAt" IS NULL
       ),
       b_all_payments AS (
         SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
         FROM billing_payment_invoice bpi
                JOIN b_all_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                JOIN billing_payment bp ON bp.id = bpi.payment
              -- todo quitar este quemado de este punto
         WHERE bp.status IN (1, 10)
           AND bp."deletedAt" IS NULL
           AND bpi."deletedAt" IS NULL
         GROUP BY bpi.invoice_concept
       ),
       b_current_fee_concepts AS (
         SELECT *
         FROM b_all_concepts bac
         WHERE bac.type = 20
       ),
       b_current_fee_payment AS (
         SELECT bap.*
         FROM b_all_payments bap
         WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_current_fee_concepts)
       ),

       b_fee_concepts AS (
         SELECT *
         FROM b_current_fee_concepts bcfc
         UNION
         SELECT *
         FROM b_all_previous_concepts bac
         WHERE bac.type = 20
       ),
       b_fee_payment AS (
         SELECT *
         FROM b_current_fee_payment
         UNION
         SELECT bap.*
         FROM b_all_previous_payments bap
         WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_fee_concepts)
       ),
       -- AQUI DEBE APLICARSE EL DESCUENTO PARA CADA FACTURA
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
                       LEFT JOIN b_fee_payment bcfp ON bcfp.invoice_concept = bcfc.invoice_concept
                WHERE bd."deletedAt" IS NULL
                  -- pendiente de esta condición porque podría no traer el descuento cuando se paga el mismo día
                  AND bcfp.date <= bd.deadline
                ORDER BY bd.deadline
              ) discount
         -- LIMIT 1
       ),
       -- filtro para validar que se puede aplicar descuento a un concepto
       -- por fecha de pago y fecha del descuento
       b_fee_concept_filte_1 AS (
         SELECT DISTINCT ON (bfc.invoice) bfc.invoice
         FROM b_fee_concepts bfc
                JOIN b_fee_payment bfp ON bfc.invoice_concept = bfp.invoice_concept
                LEFT JOIN b_all_fee_discount bacfd ON bfc.invoice_concept = bacfd.invoice_concept
              -- de este filtro deberian salir los que no tienen descuento
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
         FROM b_all_concepts bac
         WHERE bac.type = 24
         UNION
         SELECT *
         FROM b_all_previous_concepts bapc
         WHERE bapc.type = 24
         -- AND bac.price > 0
       ),
       b_interest_payment AS (
         SELECT *
         FROM (
                SELECT *
                FROM b_all_payments
                UNION
                SELECT *
                FROM b_all_previous_payments
              ) AS bap
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
         --SELECT *
         --FROM b_all_previous_concepts
         --UNION
         SELECT *
         FROM b_all_concepts
       ),
       b_join_current_and_previous_payments AS (
         SELECT *
         FROM b_all_payments
        -- UNION ALL
         --SELECT *
         --FROM b_all_previous_payments
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
       concepts_by_date AS (
         SELECT --bac.price, 
                --         bfcwd.*

                bac.residential_units,
                bac.division_value,
                bc.name,
                bac.invoice,
                bac.payment_date,
                (CASE
                   WHEN
                       SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0)) >= 0
                     THEN SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0))
                   ELSE 0
                  END
                  ) debt
                --SUM(COALESCE(bfcwd.with_discount, bac.price)) price
         FROM b_join_current_and_previous_concepts bac
                JOIN billing_concepts bc ON bc.id = bac.concept
                JOIN billing_type bt ON bt.id = bac.type
                LEFT JOIN b_fee_concepts_with_discount bfcwd ON bac.invoice_concept = bfcwd.invoice_concept
                LEFT JOIN b_join_current_and_previous_payments bap ON bap.invoice_concept = bac.invoice_concept
         GROUP BY bc.name, bac.invoice, bac.residential_units, bac.division_value, bac.payment_date
         ORDER BY bac.payment_date DESC
       ),
       order_values_by_days AS (
         SELECT cbd.residential_units,
                cbd.division_value,
                cbd.name,
                COALESCE((SELECT cbd2.debt
                          FROM concepts_by_date cbd2
                          WHERE cbd2.payment_date BETWEEN :first_begin AND :first_end
                            AND cbd.name = cbd2.name
                           --ORDER BY cbd.payment_date DESC

                         ), 0) "1_30",
                COALESCE((SELECT cbd2.debt
                          FROM concepts_by_date cbd2
                          WHERE cbd2.payment_date BETWEEN :second_begin AND :second_end
                            AND cbd.name = cbd2.name
                           --ORDER BY cbd.payment_date DESC

                         ), 0) "31_60",
                COALESCE((SELECT cbd2.debt
                          FROM concepts_by_date cbd2
                          WHERE cbd2.payment_date BETWEEN :third_begin AND :third_end
                            AND cbd.name = cbd2.name
                           --ORDER BY cbd.payment_date DESC

                         ), 0) "61_90",
                COALESCE((SELECT cbd2.debt
                          FROM concepts_by_date cbd2
                          WHERE cbd2.payment_date BETWEEN :fourth_begin AND :fourth_end
                            AND cbd.name = cbd2.name
                           --ORDER BY cbd.payment_date DESC

                         ), 0) "mas_90"
         FROM concepts_by_date cbd
         GROUP BY cbd.name, cbd.residential_units, cbd.division_value)
  SELECT *,
         ("1_30" + "31_60" + "61_90" + "mas_90") AS total
  FROM order_values_by_days
  ORDER BY residential_units ASC, division_value ASC
`)

/**
 *
 * @param queryLimit
 * @param queryFilters
 * @returns {string}
 */
export const getPaymentsMonth = (queryLimit, queryFilters, siigoFilters) => `
  WITH b_payment AS (
    SELECT bp.id,
           bp.date,
           rs.division_value,
           rs.residential_units,
           bs.name AS status,
           bt.name AS method_payment,
           bp.id   AS voucher,
           bp.amount,
           bs.id      status_id
    FROM billing_payment AS bp
           JOIN real_state rs ON rs.id = bp.real_state
           JOIN billing_status bs ON bp.status = bs.id
           JOIN billing_type bt ON bp.type = bt.id
    WHERE bp."deletedAt" IS NULL
      AND bp.date BETWEEN :start AND :end
      AND bp.project = :project
      --
      ${queryFilters}
      --
    ORDER BY bp."createdAt" DESC
  ),
       b_pending_payment AS (
         SELECT DISTINCT ON (division_value, residential_units) *
         FROM b_payment p
         WHERE p.status_id IN (:notRepeat)
       ),
       b_not_pending_payment AS (
         SELECT *
         FROM b_payment p
         WHERE p.status_id NOT IN (:notRepeat)
       )
             , result_query AS (
      SELECT *
      FROM b_pending_payment
      UNION ALL
      SELECT *
      FROM b_not_pending_payment
        ),
        result_join_siigo_voucher AS (
      SELECT rq.*,
        CASE
        WHEN sav.status = '14' THEN 'Se ha integrado correctamente'
        WHEN sav.status = '15' THEN CAST (sav.info->>'message' AS varchar)
        ELSE 'Pendiente de respuesta por siigo'
        END AS siigo_message,
        --sav.status AS code ,
        COALESCE (sav.status, '16') AS status_siigo
      FROM result_query rq
        LEFT JOIN siigo_accounting_voucher sav
      ON rq.id = sav.payment
      WHERE sav."deletedAt" IS NULL
        )
        , result_filter_voucher AS (
          SELECT *
          FROM result_join_siigo_voucher rjsv
            ${siigoFilters}
        ),
        count_result AS (
      SELECT COUNT (*)
      FROM result_filter_voucher
        )
    
      SELECT rfv.*, count_result.count
      FROM result_filter_voucher rfv,
           count_result
             ${queryLimit}
`


export const getNameUserRealState = () => (`
  SELECT U.name AS nombre
  FROM real_state_project_user rspu
         INNER JOIN "Project_User" PU ON PU.id = rspu.project_user
         INNER JOIN "User" U ON U.id = PU.id_user
  WHERE rspu.real_state = :real_state
    AND rspu."deletedAt" IS NULL
    AND (PU.type_user = :type_user_lessee OR PU.type_user = :type_user_owner)
  LIMIT 1
`)


export const queryGetPaymentsWithoutRealState = () => `
  SELECT bp.id                        AS payment,
         bp.date                      AS fechaPago,
         bp.amount                    AS monto,
         bt.description               AS medioPago,
         bp.gateway_info -> 'voucher' AS comprobante,
         bp.gateway_info -> 'note'    AS nota
  FROM billing_payment bp
         INNER JOIN billing_type bt ON bt.id = bp.type
         LEFT OUTER JOIN billing_payment_invoice bpi ON bp.id = bpi.payment
  WHERE bp.real_state IS NULL
    AND bp."deletedAt" IS NULL
    AND bpi."deletedAt" IS NULL
    AND bt."deletedAt" IS NULL `



export const paymentInfoNotifications =() => `
  SELECT bp.id, bp.gateway_info, bp.amount, bp."createdAt", p.business_name, p.nit, p.phone_number,
  p.url_logo, p.address,p.in_charge, p.phone_number, p.division, rs.id AS real_state, rs.ratio, rs.division_value,
  rs.residential_units, bt.name AS pay_method,
  (SELECT u.name
        FROM real_state_project_user rspu
                  LEFT JOIN "Project_User" pu ON rspu.project_user = pu.id
                  LEFT OUTER JOIN "User" u ON pu.id_user = u.id
        WHERE rspu.real_state = rs.id
          -- TODO QUITAR ESTOS QUEMADOS DE ACA
        AND pu.state IN ('Activo', 'Cargado', 'Pendiente')
        AND pu.type_user IN ('propietario', 'arrendatario')
        AND rspu."deletedAt" IS  NULL 
        AND pu."deletedAt" IS NULL 
        AND u."deletedAt" IS NULL
        LIMIT 1) AS name,
   (SELECT u.email
        FROM real_state_project_user rspu
                  LEFT JOIN "Project_User" pu ON rspu.project_user = pu.id
                  LEFT OUTER JOIN "User" u ON pu.id_user = u.id
        WHERE rspu.real_state = rs.id
          --TODO QUITAR ESTOS QUEMADOS DE ACA
        AND pu.state IN ('Activo', 'Cargado', 'Pendiente')
        AND pu.type_user IN ('propietario', 'arrendatario')
        AND rspu."deletedAt" IS  NULL
        AND pu."deletedAt" IS NULL
        AND u."deletedAt" IS NULL
        LIMIT 1) AS email,
        COALESCE(
          (SELECT bi.id
          FROM billing_payment bp2
          INNER JOIN billing_payment_invoice bpi on bp2.id = bpi.payment
          INNER JOIN billing_invoice_concept bic on bic.id = bpi.invoice_concept
          INNER JOIN billing_invoice bi on bic.invoice = bi.id
          where bp2.id = bp.id
              AND bpi."deletedAt" IS NULL
              AND bic."deletedAt" IS NULL
              AND bi."deletedAt" IS NULL
          ORDER BY bi."createdAt" DESC  LIMIT 1),
          (SELECT bi.id FROM billing_invoice bi 
              WHERE bi.real_state = rs.id
                        AND bi."deletedAt" IS NULL
                        ORDER BY bi."date" DESC LIMIT 1)) AS invoice
  FROM billing_payment bp
    JOIN "Project" p ON p.id = bp.project
    JOIN real_state rs ON  bp.real_state = rs.id
    JOIN billing_type bt ON bt.id = bp."type" 
  WHERE bp.id = :payment
   AND bp."deletedAt" IS NULL
    AND p.state = 'Activo'
    AND rs."deletedAt" IS NULL
    AND bp.type IN (:types)
    AND bp.status IN (:status)
  `

export const getConceptsForCheckoutQuery = () => `
    WITH b_all_invoices AS (
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
          AND bi.id = :invoice
    ),
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
--                AND bc.type != 24
         ),
         b_all_previous_payments AS (
             SELECT SUM(bpi.amount) amount, bpi.invoice_concept, MAX(bp.date) date
             FROM billing_payment_invoice bpi
                      JOIN b_all_previous_concepts bfc ON bfc.invoice_concept = bpi.invoice_concept
                      JOIN billing_payment bp ON bp.id = bpi.payment
             WHERE bp.status IN (:statusPay)
               AND bp."deletedAt" IS NULL
               AND bpi."deletedAt" IS NULL
             GROUP BY bpi.invoice_concept
         ),
         b_fee_concepts AS (
             SELECT *
             FROM b_all_previous_concepts bac
             WHERE bac.type = 20
         ),
         b_fee_payment AS (
             SELECT bap.*
             FROM b_all_previous_payments bap
             WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_fee_concepts)
         ),
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
                        AND bcfp.date <= bd.deadline
                      ORDER BY bd.deadline
                  ) discount
         ),
         b_fee_concept_filte_1 AS (
             SELECT DISTINCT ON (bfc.invoice) bfc.invoice
             FROM b_fee_concepts bfc
                      JOIN b_fee_payment bfp ON bfc.invoice_concept = bfp.invoice_concept
                      LEFT JOIN b_all_fee_discount bacfd ON bfc.invoice_concept = bacfd.invoice_concept
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
         ),
         b_interest_payment AS (
             SELECT bap.*
             FROM b_all_previous_payments bap
             WHERE bap.invoice_concept IN (SELECT invoice_concept FROM b_interest_concepts)
         ),
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
                 END)        with_discount,
                    b.invoice_concept,
                    bd.id as discount_id,
                    bd.amount,
                    bd.percentage,
                    bd.deadline
             FROM b_all_fee_discount bd
                      JOIN b_fee_concepts b ON bd.invoice_concept = b.invoice_concept
                      LEFT JOIN b_fee_payment bap ON bap.invoice_concept = b.invoice_concept
             WHERE b.invoice NOT IN (SELECT invoice FROM b_join_filter)
         ),
         b_real_state_debt AS (
             SELECT bac.concept                   id,
                    bac.name,
                    (CASE
                         WHEN
                                 SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0)) >= 0
                             THEN SUM(COALESCE(bfcwd.with_discount, bac.price) - COALESCE(bap.amount, 0))
                         ELSE 0
                        END
                        )                         price,

                    COALESCE(SUM(
                                     case
                                         when bfcwd.percentage is not null and bfcwd.percentage <= 100
                                             then ROUND_WIHOM(((bac.price / bfcwd.percentage)), bac.round::numeric)
                                         when bfcwd.percentage is not null and bfcwd.percentage > 100
                                             then 0
                                         when bfcwd.amount is not null and bac.price > bfcwd.amount
                                             then ROUND_WIHOM(bfcwd.amount, bac.round::numeric)
                                         when bfcwd.amount is not null and bac.price < bfcwd.amount
                                             then 0
                                         end), 0) "discountApplied",
                    bac.round,
                    bac.type,
                    json_build_object(
                            'id', bfcwd.discount_id,
                            'amount', bfcwd.amount,
                            'percentage', bfcwd.percentage,
                            'deadline', bfcwd.deadline
                        )                         "BillingDiscounts"
             FROM b_join_current_and_previous_concepts bac
                      JOIN b_all_invoices bai ON bai.id = bac.invoice
                      LEFT JOIN b_fee_concepts_with_discount bfcwd ON bac.invoice_concept = bfcwd.invoice_concept
                      LEFT JOIN b_join_current_and_previous_payments bap ON bap.invoice_concept = bac.invoice_concept
             GROUP BY bac.name,
                      bac.type,
                      bai.real_state,
                      bac.concept,
                      bac.invoice_concept,
                      bac.round,
                      bap.date,
                      bfcwd.discount_id,
                      bfcwd.amount,
                      bfcwd.percentage,
                      bfcwd.deadline
         )
    SELECT *
    FROM b_real_state_debt;
`


export const buildObjectForPdfManuallyPayQuery = () => `
  SELECT bp.id,
         bp.gateway_info,
         bp.amount,
         bp."createdAt",
         P.business_name,
         P.nit,
         P.phone_number,
         P.url_logo,
         P.address,
         P.in_charge,
         P.phone_number,
         P.division,
         rs.ratio,
         rs.division_value,
         rs.residential_units,
         bt.description AS pay_method,
         U.name,
         U.email
  FROM billing_payment bp
         JOIN "Project" P on P.id = bp.project
         JOIN real_state rs on bp.real_state = rs.id
         JOIN billing_type bt on bp.type = bt.id
         JOIN real_state_project_user rspu on rs.id = rspu.real_state
         JOIN "Project_User" PU on rspu.project_user = PU.id
         JOIN "User" U on PU.id_user = U.id
  WHERE bp.id = :payment
    AND p.state = 'Activo'
    AND bp.type IN (:types)
    AND pu.state IN ('Activo', 'Cargado', 'Pendiente')
    AND pu.type_user IN ('propietario', 'arrendatario')
    AND rspu."deletedAt" IS NULL
    AND pu."deletedAt" IS NULL
    AND u."deletedAt" IS NULL
    AND bp."deletedAt" IS NULL
    AND rs."deletedAt" IS NULL;`
