/**
 * Emails Library Page
 *
 * Displays all generated emails with filtering, editing, and actions.
 */

import { useEffect, useState } from 'react';
import {
  RiFileCopyLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiCheckLine,
  RiCloseLine,
  RiFilterLine,
  RiMailLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useContentItemsStore,
  useEmails,
  useEmailsLoading,
  useItemsError,
} from '@/stores/contentItemsStore';
import type { ContentItem, ContentItemStatus } from '@/types/content-hub';
import { formatDistanceToNow } from 'date-fns';

export default function EmailsLibrary() {
  const { toast } = useToast();

  const emails = useEmails();
  const isLoading = useEmailsLoading();
  const error = useItemsError();

  const fetchEmails = useContentItemsStore((state) => state.fetchEmails);
  const updateItem = useContentItemsStore((state) => state.updateItem);
  const removeItem = useContentItemsStore((state) => state.removeItem);
  const markItemAsUsed = useContentItemsStore((state) => state.markItemAsUsed);
  const markItemAsDraft = useContentItemsStore((state) => state.markItemAsDraft);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentItemStatus | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editText, setEditText] = useState('');

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const handleCopy = async (email: ContentItem) => {
    const fullContent = email.email_subject
      ? `Subject: ${email.email_subject}\n\n${email.content_text}`
      : email.content_text;
    await navigator.clipboard.writeText(fullContent);
    toast({
      title: 'Copied to clipboard',
      description: 'Email content has been copied.',
    });
  };

  const handleEdit = (email: ContentItem) => {
    setEditingId(email.id);
    setEditSubject(email.email_subject || '');
    setEditText(email.content_text);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateItem(editingId, {
      email_subject: editSubject || null,
      content_text: editText,
    });
    setEditingId(null);
    setEditSubject('');
    setEditText('');
    toast({
      title: 'Email updated',
      description: 'Your changes have been saved.',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditSubject('');
    setEditText('');
  };

  const handleToggleStatus = async (email: ContentItem) => {
    if (email.status === 'draft') {
      await markItemAsUsed(email.id);
      toast({
        title: 'Marked as used',
        description: 'Email has been marked as used.',
      });
    } else {
      await markItemAsDraft(email.id);
      toast({
        title: 'Marked as draft',
        description: 'Email has been marked as draft.',
      });
    }
  };

  const handleDelete = async (id: string) => {
    const success = await removeItem(id);
    if (success) {
      toast({
        title: 'Email deleted',
        description: 'The email has been removed from your library.',
      });
    }
  };

  const filteredEmails = emails.filter((email) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      email.content_text.toLowerCase().includes(searchLower) ||
      (email.email_subject && email.email_subject.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && email.status !== statusFilter) return false;
    return true;
  });

  const hasActiveFilters = statusFilter !== 'all' || searchTerm;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cb-vibe-orange" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => fetchEmails()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wide font-montserrat">
            Emails Library
          </h1>
          <p className="text-muted-foreground mt-1">
            {emails.length} email{emails.length !== 1 ? 's' : ''} saved
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <RiFilterLine className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>

        <Input
          placeholder="Search emails..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ContentItemStatus | 'all')}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="used">Used</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setSearchTerm('');
            }}
          >
            <RiCloseLine className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredEmails.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <RiMailLine className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium">No emails found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Generate emails from your hooks to get started'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Subject</TableHead>
                <TableHead>Body</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    {editingId === email.id ? (
                      <Input
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        placeholder="Email subject..."
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium line-clamp-2">
                        {email.email_subject || '(No subject)'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === email.id ? (
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[100px]"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap line-clamp-3 text-sm text-muted-foreground">
                        {email.content_text}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={email.status === 'used' ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => handleToggleStatus(email)}
                    >
                      {email.status === 'used' ? 'Used' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {editingId === email.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveEdit}
                          title="Save"
                        >
                          <RiCheckLine className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                          title="Cancel"
                        >
                          <RiCloseLine className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(email)}
                          title="Copy"
                        >
                          <RiFileCopyLine className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(email)}
                          title="Edit"
                        >
                          <RiEdit2Line className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(email.id)}
                          title="Delete"
                        >
                          <RiDeleteBinLine className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
