import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { heroService } from '../services/hero.service'
import type { HeroSlideFormValues } from '../schemas/hero.schema'
import type { HeroSlideRow } from '../types/hero.types'

export const heroQueryKeys = {
  adminList: ['website-hero-slides'] as const,
  adminOne: (id: string) => ['website-hero-slide', id] as const,
  publicActive: ['active-hero-slides'] as const,
}

export function useHeroSlides() {
  return useQuery({
    queryKey: heroQueryKeys.adminList,
    queryFn: () => heroService.list(),
  })
}

export function useHeroSlide(id: string | undefined) {
  return useQuery({
    queryKey: heroQueryKeys.adminOne(id ?? ''),
    queryFn: () => heroService.get(id!),
    enabled: Boolean(id),
  })
}

export function useActiveHeroSlides() {
  return useQuery({
    queryKey: heroQueryKeys.publicActive,
    queryFn: () => heroService.fetchActive(),
    staleTime: 60_000,
  })
}

function invalidateHeroQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: heroQueryKeys.adminList })
  void qc.invalidateQueries({ queryKey: heroQueryKeys.publicActive })
}

export function useHeroSlideMutations() {
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: (values: HeroSlideFormValues) => heroService.create(values),
    onSuccess: () => invalidateHeroQueries(qc),
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: HeroSlideFormValues }) =>
      heroService.update(id, values),
    onSuccess: (_data, vars) => {
      invalidateHeroQueries(qc)
      void qc.invalidateQueries({ queryKey: heroQueryKeys.adminOne(vars.id) })
    },
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HeroSlideRow['status'] }) =>
      heroService.setStatus(id, status),
    onSuccess: () => invalidateHeroQueries(qc),
  })

  const archive = useMutation({
    mutationFn: (id: string) => heroService.archive(id),
    onSuccess: () => invalidateHeroQueries(qc),
  })

  const restore = useMutation({
    mutationFn: (id: string) => heroService.restore(id),
    onSuccess: () => invalidateHeroQueries(qc),
  })

  const duplicate = useMutation({
    mutationFn: (id: string) => heroService.duplicate(id),
    onSuccess: () => invalidateHeroQueries(qc),
  })

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => heroService.reorder(orderedIds),
    onSuccess: () => invalidateHeroQueries(qc),
  })

  return { create, update, setStatus, archive, restore, duplicate, reorder }
}
