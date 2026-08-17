// Minimum request amounts, in UGX. Mirrored client-side in
// client/src/utils/limits.js for immediate form feedback — this is the
// version that's actually enforced.
const MIN_AMOUNT = {
  WITHDRAW: 2000,
  DEPOSIT: 1000,
};

module.exports = { MIN_AMOUNT };
