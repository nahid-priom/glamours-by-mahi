import * as heroRepo from '../repositories/hero.repository'
import type { HeroSlideFormValues } from '../schemas/hero.schema'
import type { HeroSlideRow } from '../types/hero.types'

export const heroService = {
  list: () => heroRepo.listHeroSlides(),
  get: (id: string) => heroRepo.getHeroSlide(id),
  create: (values: HeroSlideFormValues) => heroRepo.createHeroSlide(values),
  update: (id: string, values: HeroSlideFormValues) => heroRepo.updateHeroSlide(id, values),
  setStatus: (id: string, status: HeroSlideRow['status']) => heroRepo.setHeroSlideStatus(id, status),
  archive: (id: string) => heroRepo.archiveHeroSlide(id),
  restore: (id: string) => heroRepo.restoreHeroSlide(id),
  duplicate: (id: string) => heroRepo.duplicateHeroSlide(id),
  reorder: (orderedIds: string[]) => heroRepo.reorderHeroSlides(orderedIds),
  uploadImage: (slideId: string, file: File, kind: 'desktop' | 'mobile') =>
    heroRepo.uploadHeroImage(slideId, file, kind),
  removeImage: (path: string) => heroRepo.removeHeroImage(path),
  kpis: heroRepo.computeHeroKpis,
  fetchActive: heroRepo.fetchActiveHeroSlides,
  mediaUrl: heroRepo.resolveWebsiteMediaUrl,
}
