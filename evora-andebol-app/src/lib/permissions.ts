import type { Role } from '../context/AuthContext'

export const canManageFines = (role: Role) =>
  role === 'sindicato' || role === 'admin'

export const canSeeAllFines = (role: Role) =>
  role === 'sindicato' || role === 'admin' || role === 'equipa_tecnica'

export const canSeeLeaderboard = (role: Role) =>
  role === 'sindicato' || role === 'admin' || role === 'equipa_tecnica'

export const canManageAttendance = (role: Role) =>
  role === 'equipa_tecnica' || role === 'admin'

export const canUseAssistant = (_role: Role) => true

export const roleLabel = (role: Role) => {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'sindicato':
      return 'Sindicato'
    case 'equipa_tecnica':
      return 'Equipa Técnica'
    case 'jogador':
      return 'Jogador'
  }
}