export const ORGANIZATION_OPTIONS = [
  'FAAN',
  'AAAU',
  'NCAA',
  'NCAT',
  'NAMA',
  'NiMet',
  'NSIB',
] as const

export const GRADE_LEVEL_OPTIONS = Array.from(
  { length: 17 },
  (_, index) => String(index + 1).padStart(2, '0')
)

export const DEPARTMENT_OPTIONS = [
  'Airport Operations',
  'Aviation Security (AVSEC)',
  'Engineering Services',
  'Commercial and Business Development',
  'Finance and Accounts',
  'Human Resources and Administration',
  'Public Affairs and Consumer Protection',
  'Legal Services',
  'Cargo Services',
  'Corporate Services',
  'Special Duties',
] as const

export const STATION_OPTIONS = [
  'Murtala Muhammed International Airport (LOS) - Ikeja, Lagos State',
  'Nnamdi Azikiwe International Airport (ABV) - Abuja, Federal Capital Territory',
] as const
