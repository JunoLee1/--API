import axios from "axios"

export class CountryApiClient {
    async getAllCountries() {
    const res = await axios.get("https://restcountries.com/v3.1/all");
    return res.data
  }
  async getCountryByCode (code: string){
     const res = await axios.get(`https://restcountries.com/v3.1/${code}`);
     return res.data
  }

}