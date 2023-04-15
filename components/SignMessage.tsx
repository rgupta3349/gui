import React, { useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { ToastContext } from './ToastContextProvider';
import { useTXLogs } from "../hooks/useTXLogs";
import LoadingButton from './LoadingButton';
import { isMetaMaskError } from '../utils/isMetaMaskError';
import { isEthersError } from '../utils/isEthersError';

export default function SignMessage({
                                      nominator,
                                      nominee,
                                      stakeAmount,
                                      onStake
                                    }: { nominator: string, nominee: string, stakeAmount: string, onStake?: () => void }) {
  const {showTemporarySuccessMessage, showErrorMessage} = useContext(ToastContext);

  const requiredStake = ethers.utils.parseEther(stakeAmount).toString()

  const createStakeLog = (data: any, params: { data: any }, hash: string, sender: string) => {
    params.data = JSON.parse(data)
    const logData = {
      tx: params,
      sender,
      txHash: hash
    }

    return JSON.stringify(logData)
  }

  const sendTransaction = async (e: any, blobData: any) => {
    setLoading(true);
    const {writeStakeLog} = useTXLogs()
    try {
      // @ts-ignore
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const [gasPrice, from, nonce] = await Promise.all([
        signer.getGasPrice(),
        signer.getAddress(),
        signer.getTransactionCount()
      ]);

      console.log("BLOB: ", blobData);

      const value = ethers.BigNumber.from(JSON.parse(blobData).stake);

      const params = {
        from,
        to: "0x0000000000000000000000000000000000000001",
        gasPrice,
        gasLimit: 30000000,
        value,
        data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes(blobData)),
        nonce
      };
      console.log("Params: ", params);

      const {hash, data, wait} = await signer.sendTransaction(params);
      console.log("TX RECEIPT: ", {hash, data});
      await writeStakeLog(createStakeLog(blobData, params, hash, from))

      const txConfirmation = await wait();
      console.log("TX CONFRIMED: ", txConfirmation);
      showTemporarySuccessMessage('Stake successful!');
    } catch (error: unknown) {
      console.error(error);
      let errorMessage = (error as Error)?.message || String(error);

      // 4001 is the error code for when a user rejects a transaction
      if ((isMetaMaskError(error) && error.code === 4001)
        || (isEthersError(error) && error.code === 'ACTION_REJECTED')) {
        errorMessage = 'Transaction rejected by user';
      }
      showErrorMessage(errorMessage);
    }
    setLoading(false);
    onStake?.();
  };

  const signMessage = async ({message}: any) => {
    try {
      // @ts-ignore
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const hash = ethers.utils.hashMessage(message);
      // const hash = hashPersonalMessage(Buffer.from(message, "utf8"));
      console.log("HASH: ", hash);
      const signature = await signer.signMessage(hash);
      console.log("SIGNATURE: ", signature);

      const from = await signer.getAddress();
      return {
        owner: from,
        hash,
        sig: signature
      };
    } catch (err: any) {
      console.error(err)
    }
  };

  const [isLoading, setLoading] = useState(false);
  const [data, setData] = useState({
    isInternalTx: true,
    internalTXType: 6,
    nominator: nominator.toLowerCase(),
    nominee,
    stake: requiredStake,
    timestamp: Date.now(),
    stakeOk: true,
  });

  useEffect(() => {
      setData({
        ...data,
        nominator: nominator.toLowerCase(),
        nominee,
        stake: requiredStake,
      });
    },
    [nominator, nominee]
  )

  // @ts-ignore
  window.ethereum.on("accountsChanged", (accounts: any) => {
    setData({...data, nominator: accounts[0].toLowerCase()});
  });

  console.log("DATA: ", data);

  const handleSign = async (e: any) => {
    try {
      e.preventDefault();
      const formData = new FormData(e.target).get("message");

      const sign = await signMessage({
        message: formData
      });
      if (sign!.sig) {
        // @ts-ignore
        setData({...data, sign});
        console.log("Data af Sig: ", data);
        // setSignatures([...signatures, sig]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSign}>
        <label htmlFor="rewardWallet" className="block">Stake Wallet Address</label>
        <input id="rewardWallet" value={data.nominator} type="text"
               className="bg-white text-black p-3 mt-2 w-full block border border-black"
               disabled/>
        <label className="block mt-4">
          Nominee Public Key
        </label>
        <input
          required
          type="text"
          name="nominee"
          className="bg-white text-black p-3 mt-2 w-full block border border-black"
          placeholder="Nominee Public Key"
          value={data.nominee}
          onChange={(e) =>
            //@ts-ignore
            setData({...data, nominee: e.target.value.toLowerCase()})
          }
        />
        <label className="block mt-4">
          Stake Amount (SHM)
        </label>
        <input
          required
          type="text"
          name="stake"
          className="bg-white text-black p-3 mt-2 w-full border border-black"
          placeholder="Stake Amount (SHM)"
          onChange={(e) => {
            try {
              const newValue = e.target.value.toString();

              if (!newValue) throw new Error("invalid value")

              const stake = ethers.utils
                .parseEther(newValue)
                .toString();

              setData({
                ...data,
                //@ts-ignore
                stake: stake,
                stakeOk: true,
              })
            } catch (e) {
              setData({
                ...data,
                stakeOk: false,
              })
            }
          }
          }
        />
        <div className={`flex items-center mb-5 ${!data.stakeOk ? "text-red-500" : ""}`}>
          <div className="ml-2 font-semibold">Stake requirement: {stakeAmount}</div>
        </div>
      </form>

      <div className="mt-5 float-right">
        <LoadingButton
          onClick={async (e) => sendTransaction(e, JSON.stringify(data))}
          isLoading={isLoading}
          className={`btn btn-primary ${isLoading || !data.stakeOk ? "btn-disabled" : ""}`}
        >
          Stake
          <ArrowRightIcon className="h-5 w-5 inline ml-2"/>
        </LoadingButton>
      </div>
    </div>
  )
    ;
}
