'use strict';
// Kullanıcının yüklediği Efor Takip Çizelgesi.xlsx dosyasından alınan başlangıç verileri.
const staff = ['Salih Akkaya', 'Aleyna Topkara', 'Enes Yılmaz'];
const categories = {
  clients: ['Yeşilay','Astor Enerji','Türk EximBank','SBÜ'],
  projects: ['Genel Destek','Periyodik Bakım','Network Yenileme','Güvenlik İyileştirme','SD-WAN','Kablosuz Ağ','Sistem Kurulumu','PoC / Test','Devreye Alma','NAC','Manager','Analyzer','Authenticator','Mail','Proxy'],
  work_types: ['Analiz / Keşif','Projelendirme','Kurulum / Konfigürasyon','Sorun Giderme','Bakım / Operasyon / Kontrol','Toplantı','Dokümantasyon','Test / PoC','Eğitim','Diğer'],
  statuses: ['Tamamlandı','Devam Ediyor','Beklemede','Üretici Onayı Bekliyor'],
  work_modes: ['Uzaktan','Yerinde','Hibrit']
};
const entries = [
  {owner:'Salih Akkaya',work_date:'2026-11-01',client:'Yeşilay',project:'Kablosuz Ağ',work_type:'Kurulum / Konfigürasyon',hours:5,status:'Devam Ediyor',work_mode:'Hibrit',notes:''},
  {owner:'Aleyna Topkara',work_date:'2026-11-01',client:'Türk EximBank',project:'Kablosuz Ağ',work_type:'Kurulum / Konfigürasyon',hours:5,status:'Devam Ediyor',work_mode:'Hibrit',notes:''},
  {owner:'Enes Yılmaz',work_date:'2026-11-01',client:'SBÜ',project:'Kablosuz Ağ',work_type:'Kurulum / Konfigürasyon',hours:5,status:'Devam Ediyor',work_mode:'Hibrit',notes:''}
];
module.exports={staff,categories,entries};
