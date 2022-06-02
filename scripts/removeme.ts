import { ethers } from "ethers";

const spendFeeAbi = [{
    "inputs": [
     {
       "internalType": "bool",
       "name": "sendToOwner",
       "type": "bool"
     },
     {
       "internalType": "uint256",
       "name": "deadline",
       "type": "uint256"
     }
    ],
    "name": "spendFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}];

const iface = new ethers.utils.Interface(spendFeeAbi);
const sendToOwner: boolean = false;
const deadline: number = 1_654_177_510;
console.log(iface.encodeFunctionData("spendFees", [sendToOwner, deadline]));
