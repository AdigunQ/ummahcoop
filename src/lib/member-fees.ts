export const MEMBER_MONTHLY_CHARGE = 100
export const MEMBER_FORM_FEE = 1000

export function calculateMemberFees(isNewMember: boolean) {
  const monthlyCharges = MEMBER_MONTHLY_CHARGE
  const newMemberFee = isNewMember ? MEMBER_FORM_FEE : 0
  return { monthlyCharges, newMemberFee, memberFee: monthlyCharges + newMemberFee }
}
