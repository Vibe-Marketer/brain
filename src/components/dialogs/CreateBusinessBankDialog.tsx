/**
 * CreateBusinessBankDialog - Dialog for creating business banks
 *
 * Full configuration upfront: name, cross-bank recording default,
 * and default vault name. After creation: auto-switches to new bank
 * and navigates to /vaults.
 *
 * @pattern dialog-form
 * @brand-version v4.2
 */

import { useState, useCallback } from 'react'
import {
  RiBuildingLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiInformationLine,
} from '@remixicon/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateVaultDialog } from '@/components/dialogs/CreateVaultDialog'
import { useCreateBusinessBank } from '@/hooks/useBankMutations'

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export interface CreateBusinessBankDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateBusinessBankDialog({
  open,
  onOpenChange,
}: CreateBusinessBankDialogProps) {
  const [name, setName] = useState('')
  const [defaultVaultName, setDefaultVaultName] = useState('')
  const [crossBankDefault, setCrossBankDefault] = useState<'copy_only' | 'copy_and_remove'>('copy_only')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [createVaultOpen, setCreateVaultOpen] = useState(false)
  const [createdBankId, setCreatedBankId] = useState<string | null>(null)
  const createBank = useCreateBusinessBank()

  const isValid = name.trim().length >= 3 && name.trim().length <= 50

  const handleSubmit = useCallback(() => {
    if (!isValid) return

    createBank.mutate(
      {
        name: name.trim(),
        crossBankDefault,
        logoUrl: logoDataUrl || undefined,
        defaultVaultName: defaultVaultName.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          // Reset form
          setName('')
          setDefaultVaultName('')
          setCrossBankDefault('copy_only')
          setShowAdvanced(false)
          setLogoDataUrl(null)
          setLogoError(null)
          setCreatedBankId(data.bank.id)
          setCreateVaultOpen(true)
          onOpenChange(false)
        },
      }
    )
  }, [name, crossBankDefault, defaultVaultName, isValid, logoDataUrl, createBank, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && isValid && !createBank.isPending) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, isValid, createBank.isPending]
  )

  const handleLogoChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      setLogoDataUrl(null)
      setLogoError(null)
      return
    }

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoDataUrl(null)
      setLogoError('Please upload a PNG, JPG, or SVG file')
      event.target.value = ''
      return
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoDataUrl(null)
      setLogoError('Logo must be 2MB or smaller')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setLogoDataUrl(typeof reader.result === 'string' ? reader.result : null)
      setLogoError(null)
    }
    reader.onerror = () => {
      setLogoDataUrl(null)
      setLogoError('Unable to read logo file')
      event.target.value = ''
    }
    reader.readAsDataURL(file)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]" aria-describedby="create-bank-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
              <RiBuildingLine className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Create Business Bank</DialogTitle>
              <DialogDescription id="create-bank-description">
                Set up an organization to collaborate with your team
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Organization Name (required) */}
          <div className="space-y-2">
            <Label htmlFor="bank-name">
              Organization Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Acme Inc."
              autoFocus
              maxLength={50}
            />
            {name.trim().length > 0 && name.trim().length < 3 && (
              <p className="text-xs text-destructive">
                Name must be at least 3 characters
              </p>
            )}
          </div>

          {/* Logo (optional) */}
          <div className="space-y-2">
            <Label htmlFor="bank-logo">Logo (optional)</Label>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
                {logoDataUrl ? (
                  <img
                    src={logoDataUrl}
                    alt="Logo preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <RiBuildingLine className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Input
                  id="bank-logo"
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg"
                  onChange={handleLogoChange}
                  disabled={createBank.isPending}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, or SVG up to 2MB
                </p>
              </div>
            </div>
            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
          </div>

          {/* Default Vault Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="default-vault-name">Default Vault Name</Label>
            <Input
              id="default-vault-name"
              value={defaultVaultName}
              onChange={(e) => setDefaultVaultName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={name.trim() ? `${name.trim()}'s Vault` : "Your first vault in this bank"}
            />
            <p className="text-xs text-muted-foreground">
              Your first vault in this bank. Leave blank for default.
            </p>
          </div>

          {/* Advanced Settings (collapsed) */}
          <div className="border border-border rounded-lg">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className="font-medium">Advanced Settings</span>
              {showAdvanced ? (
                <RiArrowUpSLine className="h-4 w-4" />
              ) : (
                <RiArrowDownSLine className="h-4 w-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                {/* Cross-Bank Recording Default */}
                <div className="space-y-2">
                  <Label htmlFor="cross-bank-default">
                    Cross-Bank Recording Behavior
                  </Label>
                  <Select
                    value={crossBankDefault}
                    onValueChange={(v) => setCrossBankDefault(v as 'copy_only' | 'copy_and_remove')}
                  >
                    <SelectTrigger id="cross-bank-default">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="copy_only">
                        Copy only (keep in source)
                      </SelectItem>
                      <SelectItem value="copy_and_remove">
                        Copy and remove from source
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <RiInformationLine className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      {crossBankDefault === 'copy_only'
                        ? 'Recordings copied to this bank also stay in the source bank.'
                        : 'Recordings moved to this bank are removed from the source bank.'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="hollow"
            onClick={() => onOpenChange(false)}
            disabled={createBank.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createBank.isPending}
          >
            {createBank.isPending ? 'Creating...' : 'Create Business Bank'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {createdBankId && (
        <CreateVaultDialog
          open={createVaultOpen}
          onOpenChange={setCreateVaultOpen}
          bankId={createdBankId}
        />
      )}
    </Dialog>
  )
}

export default CreateBusinessBankDialog
