import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import AddSeries from 'AddSeries/AddSeries';
import { AddSeriesOptions } from 'AddSeries/addSeriesOptionsStore';
import useApiMutation, {
  addOrUpdateQueryClientItem,
} from 'Helpers/Hooks/useApiMutation';
import useApiQuery from 'Helpers/Hooks/useApiQuery';
import Series from 'Series/Series';

interface AddSeriesPayload
  extends AddSeries,
    Omit<
      AddSeriesOptions,
      'monitor' | 'searchForMissingEpisodes' | 'searchForCutoffUnmetEpisodes'
    > {}

const DEFAULT_SERIES: AddSeries[] = [];

export const useLookupSeries = (
  query: string,
  provider?: string,
  isEnabled = true
) => {
  const isAll = !provider;
  const primaryProvider = isAll ? 'tvdb' : provider;

  const resultPrimary = useApiQuery<AddSeries[]>({
    path: '/series/lookup',
    queryParams: {
      term: query,
      ...(primaryProvider ? { provider: primaryProvider } : {}),
    },
    queryOptions: {
      enabled: isEnabled && !!query,
      // Disable refetch on window focus to prevent refetching when the user switch tabs
      refetchOnWindowFocus: false,
    },
  });

  const resultAnidb = useApiQuery<AddSeries[]>({
    path: '/series/lookup',
    queryParams: {
      term: query,
      provider: 'anidb',
    },
    queryOptions: {
      enabled: isEnabled && !!query && isAll,
      refetchOnWindowFocus: false,
    },
  });

  const primaryResultData = resultPrimary.data;
  const anidbResultData = resultAnidb.data;

  // Memoized so consumers that depend on `data` in effects don't loop
  const mergedData = useMemo(() => {
    const primaryData = primaryResultData || DEFAULT_SERIES;
    const anidbData = anidbResultData || DEFAULT_SERIES;

    if (!isAll || anidbData.length === 0) {
      return primaryData;
    }

    const existingIds = new Set(
      primaryData.map((s) => s.tvdbId).filter(Boolean)
    );
    const existingTitles = new Set(
      primaryData.map((s) => s.title.toLowerCase())
    );

    const uniqueAnidb = anidbData.filter(
      (s) =>
        !existingIds.has(s.tvdbId) && !existingTitles.has(s.title.toLowerCase())
    );

    return [...primaryData, ...uniqueAnidb];
  }, [isAll, primaryResultData, anidbResultData]);

  const isFetching = isAll
    ? resultPrimary.isFetching || resultAnidb.isFetching
    : resultPrimary.isFetching;

  // In combined mode the lookup isn't done until both providers have answered,
  // otherwise consumers act on partial (TVDB-only) results
  const isFetched = isAll
    ? resultPrimary.isFetched && resultAnidb.isFetched
    : resultPrimary.isFetched;

  // Only surface an error when nothing usable came back
  const error =
    mergedData.length > 0 ? null : resultPrimary.error || resultAnidb.error;

  const { refetch: refetchPrimary } = resultPrimary;
  const { refetch: refetchAnidb } = resultAnidb;

  const refetch = useCallback(() => {
    // refetch ignores `enabled`, so only hit AniDB when it's part of the lookup
    return Promise.all(
      isAll ? [refetchPrimary(), refetchAnidb()] : [refetchPrimary()]
    );
  }, [isAll, refetchPrimary, refetchAnidb]);

  return {
    ...resultPrimary,
    isFetching,
    isFetched,
    error,
    refetch,
    data: mergedData.length > 0 ? mergedData : DEFAULT_SERIES,
  };
};

export const useAddSeries = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  const { isPending, error, mutate } = useApiMutation<Series, AddSeriesPayload>(
    {
      path: '/series',
      method: 'POST',
      mutationOptions: {
        onSuccess: (newSeries) => {
          queryClient.setQueryData<Series[]>(['/series'], (oldSeries = []) =>
            addOrUpdateQueryClientItem(oldSeries, newSeries, 'id')
          );
          onSuccess?.();
        },
      },
    }
  );

  return {
    isAdding: isPending,
    addError: error,
    addSeries: mutate,
  };
};
