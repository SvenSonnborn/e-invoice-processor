'use client'

import { switchOrganization } from '@/app/actions/organizations'
import { signOut } from '@/app/actions/auth'
import { useState } from 'react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

interface OrgSwitcherProps {
  organizations: Organization[]
  activeOrgId: string
}

export function OrgSwitcher({ organizations, activeOrgId }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const activeOrg = organizations.find((org) => org.id === activeOrgId)

  async function handleSwitch(orgId: string) {
    setIsOpen(false)
    await switchOrganization(orgId)
  }

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
      >
        <span>{activeOrg?.name}</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Organisationen
              </p>
            </div>

            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                  org.id === activeOrgId ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{org.name}</span>
                  {org.id === activeOrgId && (
                    <svg
                      className="w-4 h-4 text-indigo-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-500">{org.role}</span>
              </button>
            ))}

            <div className="border-t border-gray-100 mt-1">
              <Link
                href="/onboarding"
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                + Neue Organisation erstellen
              </Link>
            </div>

            <div className="border-t border-gray-100 mt-1">
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Abmelden
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
