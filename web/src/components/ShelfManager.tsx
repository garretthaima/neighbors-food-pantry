import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, messageOf } from '../api';
import { count } from '../format';
import type { Shelf } from '../types';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormField } from '../ui/FormField';
import { ResponsivePanel } from '../ui/ResponsivePanel';
import { useToast } from '../ui/Toast';

interface Props {
  shelves: Shelf[];
  onChanged: () => Promise<void>;
  onClose: () => void;
}

export function ShelfManager({ shelves, onChanged, onClose }: Props) {
  const showToast = useToast();
  const [name, setName] = useState('');
  const [addError, setAddError] = useState('');
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [removing, setRemoving] = useState<Shelf | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setAddError('Type a name for the shelf.');
      return;
    }
    try {
      await api.createShelf(name);
      setName('');
      setAddError('');
      showToast('Shelf added');
      await onChanged();
    } catch (err) {
      setAddError(messageOf(err));
    }
  }

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    try {
      await api.renameShelf(renaming.id, renaming.name);
      setRenaming(null);
      showToast('Shelf renamed');
      await onChanged();
    } catch (err) {
      showToast(messageOf(err), 'error');
    }
  }

  async function remove() {
    try {
      await api.deleteShelf(removing!.id);
      showToast('Shelf removed');
      await onChanged();
    } catch (err) {
      showToast(messageOf(err), 'error');
    }
    setRemoving(null);
  }

  return (
    <ResponsivePanel title="Shelves" onClose={onClose}>
      <form className="inline-form" onSubmit={add} noValidate>
        <FormField
          label="New shelf"
          hint="Name it the way it is labelled in the room: A1, Top left, Freezer."
          error={addError}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoFocus
        />
        <Button type="submit" variant="primary" icon={<Plus size={18} />}>
          Add shelf
        </Button>
      </form>

      {shelves.length > 0 && (
        <ul className="shelf-list">
          {shelves.map((shelf) =>
            renaming?.id === shelf.id ? (
              <li key={shelf.id}>
                <form className="shelf-rename" onSubmit={rename}>
                  <FormField
                    label={<span className="visually-hidden">New name for {shelf.name}</span>}
                    value={renaming.name}
                    onChange={(event) => setRenaming({ id: shelf.id, name: event.target.value })}
                    maxLength={60}
                    autoFocus
                  />
                  <Button type="submit" variant="primary" iconOnly aria-label="Save name" icon={<Check size={18} />} />
                  <Button
                    variant="ghost"
                    iconOnly
                    aria-label="Cancel rename"
                    icon={<X size={18} />}
                    onClick={() => setRenaming(null)}
                  />
                </form>
              </li>
            ) : (
              <li key={shelf.id}>
                <span className="shelf-list-name">{shelf.name}</span>
                <span className="muted">{count(shelf.itemCount, 'item')}</span>
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={`Rename ${shelf.name}`}
                  icon={<Pencil size={18} />}
                  onClick={() => setRenaming({ id: shelf.id, name: shelf.name })}
                />
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={`Remove ${shelf.name}`}
                  icon={<Trash2 size={18} />}
                  onClick={() => setRemoving(shelf)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      {removing && (
        <ConfirmDialog
          title="Remove this shelf?"
          confirmLabel="Remove shelf"
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        >
          <p>
            <strong>{removing.name}</strong> will be removed.
            {removing.productCount > 0 &&
              ` The ${count(removing.productCount, 'product')} on it stay in the inventory, without a shelf.`}
          </p>
        </ConfirmDialog>
      )}
    </ResponsivePanel>
  );
}
