import { useEffect } from 'react';
import { useLookupSeries } from 'AddSeries/AddNewSeries/useAddSeries';
import getErrorMessage from 'Utilities/Object/getErrorMessage';
import translate from 'Utilities/String/translate';
import {
  removeFromLookupQueue,
  updateImportSeriesItem,
  useCurrentLookupQueueItemId,
  useImportSeriesItem,
} from './importSeriesStore';

// Works through the lookup queue one item at a time. This lives outside the
// virtualized table on purpose: when lookups ran inside the rows, the queue
// stalled at the first queued row that wasn't rendered (scrolled out of view).
function ImportSeriesLookupQueue() {
  const id = useCurrentLookupQueueItemId();
  const item = useImportSeriesItem(id ?? '');
  const term = item ? item.term ?? item.name : '';

  const { isFetched, isFetching, error, data } = useLookupSeries(
    term,
    item?.provider,
    !!item
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    // Item was imported or cleared while queued, or there's nothing to search
    if (!item || !term) {
      removeFromLookupQueue(id);
      return;
    }

    // Wait for a fresh result; cached results are refetched when the item
    // becomes current, and applying the stale ones would hide that refetch
    if (!isFetched || isFetching) {
      return;
    }

    updateImportSeriesItem({
      id,
      hasSearched: true,
      selectedSeries: data[0],
      lookupError: error
        ? getErrorMessage(error, translate('SearchFailedError'))
        : undefined,
    });

    removeFromLookupQueue(id);
  }, [id, item, term, isFetched, isFetching, error, data]);

  return null;
}

export default ImportSeriesLookupQueue;
